#!/usr/bin/env python3
"""
generate_shortcut.py — builds per-member pocket.prompts iOS shortcuts (v7)

v7 architecture: zero variable references in action parameters.
the shortcut sends dictated text as a raw POST body to a per-member
URL endpoint. all intelligence lives on the server.

previous versions failed because `shortcuts sign` strips complex nested
parameters (WFJSONValues, WFInput, WFConditionalActionString). v7 uses
only static string/bool parameters and the implicit pipeline for data flow.

shortcut structure (6 actions):
  1. Repeat 20x (start)
  2. Dictate Text → pipeline
  3. Get Contents of URL (POST, static WFURL, body from pipeline via "File" type)
  4. Get Dictionary Value "spoken_response" → pipeline
  5. Speak Text (reads from pipeline, waits for completion)
  6. Repeat (end)

usage:
  python3 shortcuts/generate_shortcut.py

output:
  public/shortcuts/pocket-prompts-{member}.shortcut (signed, per member)
"""

import plistlib
import uuid
import os
import subprocess
import json


# --- config ---
API_BASE = "https://pocket-prompts-five.vercel.app/api/voice"
REPEAT_COUNT = 20
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
OUTPUT_DIR = os.path.join(PROJECT_DIR, "public", "shortcuts")
MEMBERS_FILE = os.path.join(PROJECT_DIR, "config", "members.json")


def make_uuid():
    """generate an uppercase UUID for action grouping"""
    return str(uuid.uuid4()).upper()


def act(identifier, parameters=None):
    """create a shortcut action dict"""
    return {
        "WFWorkflowActionIdentifier": identifier,
        "WFWorkflowActionParameters": parameters or {}
    }


def tts(text):
    """plain text token string — no variable attachments, survives signing"""
    return {
        "Value": {"attachmentsByRange": {}, "string": text},
        "WFSerializationType": "WFTextTokenString"
    }


def build_shortcut(member_name):
    """
    build the v7 shortcut action list for a specific member.

    key design constraint: NO variable references in any action parameter.
    all data flows through the implicit pipeline between chained actions.
    all parameter values are static strings/bools that survive code-signing.
    """

    actions = []
    repeat_group = make_uuid()
    api_url = f"{API_BASE}/{member_name}"

    # === action 1: Repeat start (20 voice interactions per session) ===
    actions.append(act("is.workflow.actions.repeat.count", {
        "GroupingIdentifier": repeat_group,
        "WFControlFlowMode": 0,    # 0 = start
        "WFRepeatCount": REPEAT_COUNT
    }))

    # === action 2: Dictate Text ===
    # output goes to pipeline → picked up by Get Contents as POST body
    actions.append(act("is.workflow.actions.dictatetext", {
        "WFDictateTextStopListening": "After Short Pause",
        "WFSpeechLanguage": "en-US"
    }))

    # === action 3: Get Contents of URL (POST raw body) ===
    # WFURL: static string (survives signing — confirmed in v6)
    # WFHTTPMethod: static string (survives signing)
    # WFHTTPBodyType: "File" — tells Shortcuts to use the pipeline input as the body
    # Advanced: bool (survives signing)
    # NO WFJSONValues, NO variable references, NO nested dictionaries
    actions.append(act("is.workflow.actions.downloadurl", {
        "WFURL": tts(api_url),
        "Advanced": True,
        "WFHTTPMethod": "POST",
        "WFHTTPBodyType": "File"
    }))

    # === action 4: Get Dictionary Value ===
    # extracts "spoken_response" from the JSON response (auto-parsed by Shortcuts)
    # WFDictionaryKey: static string (survives signing)
    actions.append(act("is.workflow.actions.getvalueforkey", {
        "WFGetDictionaryValueType": "Value",
        "WFDictionaryKey": "spoken_response"
    }))

    # === action 5: Speak Text ===
    # reads from pipeline (Get Dictionary Value output)
    # WFSpeakTextWait: True — waits for speech to finish before next loop iteration
    actions.append(act("is.workflow.actions.speaktext", {
        "WFSpeakTextWait": True
    }))

    # === action 6: Repeat end ===
    actions.append(act("is.workflow.actions.repeat.count", {
        "GroupingIdentifier": repeat_group,
        "WFControlFlowMode": 2    # 2 = end
    }))

    return actions


def build_plist(actions):
    """wrap actions in the full shortcut plist structure"""
    return {
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowMinimumClientVersionString": "900",
        "WFWorkflowIcon": {
            "WFWorkflowIconStartColor": 4282601983,   # blue
            "WFWorkflowIconGlyphNumber": 59771         # microphone glyph
        },
        "WFWorkflowClientVersion": "2302.0.4",
        "WFWorkflowClientRelease": "2302.0.4",
        "WFWorkflowTypes": ["NCWidget", "WatchKit"],
        "WFWorkflowInputContentItemClasses": ["WFStringContentItem"],
        "WFWorkflowOutputContentItemClasses": [],
        "WFWorkflowImportQuestions": [],
        "WFWorkflowActions": actions,
        "WFWorkflowHasShortcutInputVariables": False,
        "WFWorkflowHasOutputFallback": False
    }


def main():
    # load members
    with open(MEMBERS_FILE) as f:
        members = json.load(f)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    success_count = 0

    for member_name in members:
        unsigned = os.path.join(SCRIPT_DIR, f"pocket-prompts-{member_name}-unsigned.shortcut")
        signed = os.path.join(OUTPUT_DIR, f"pocket-prompts-{member_name}.shortcut")

        # build shortcut
        actions = build_shortcut(member_name)
        plist = build_plist(actions)

        # write unsigned binary plist
        with open(unsigned, "wb") as f:
            plistlib.dump(plist, f, fmt=plistlib.FMT_BINARY)

        # sign (retry once on transient Apple signing server errors)
        signed_ok = False
        for attempt in range(2):
            result = subprocess.run(
                ["shortcuts", "sign", "--mode", "anyone",
                 "--input", unsigned, "--output", signed],
                capture_output=True, text=True
            )
            if result.returncode == 0:
                signed_ok = True
                break
            if attempt == 0:
                print(f"  ! {member_name}: sign attempt 1 failed, retrying...")

        # clean up unsigned file
        if os.path.exists(unsigned):
            os.remove(unsigned)

        if signed_ok:
            success_count += 1
            print(f"  + {member_name}: {len(actions)} actions -> {os.path.basename(signed)}")
        else:
            print(f"  x {member_name}: sign failed — {result.stderr.strip()[:200]}")

    print()
    print(f"[shortcut] generated {success_count}/{len(members)} shortcuts (v7)")
    print(f"[shortcut] architecture: raw POST body, per-member URL, 6 actions")
    print(f"[shortcut] api base: {API_BASE}/{{member}}")
    print()

    # show install URLs
    base_url = "https://pocket-prompts-five.vercel.app/shortcuts"
    for member_name in members:
        shortcut_url = f"{base_url}/pocket-prompts-{member_name}.shortcut"
        install_url = f"shortcuts://import-shortcut?url={shortcut_url}&name=pocket.prompts"
        print(f"  {member_name}: {install_url}")


if __name__ == "__main__":
    main()
