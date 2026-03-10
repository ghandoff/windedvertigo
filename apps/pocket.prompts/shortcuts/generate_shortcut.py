#!/usr/bin/env python3
"""
generate_shortcut.py — builds per-member pocket.prompts iOS shortcuts (v8)

v8 architecture: two critical fixes from v7 diagnostics:
  1. sign with --mode people-who-know-me (not "anyone" — that strips HTTP params)
  2. API returns plain text (not JSON) — Get Dictionary Value hangs after signing

shortcut structure (5 actions):
  1. Repeat 20x (start)
  2. Dictate Text → pipeline (text)
  3. Get Contents of URL (POST with File body — sends dictated text to server)
  4. Speak Text (response is already plain text — no dict extraction needed)
  5. Repeat (end)

the per-member API endpoint (/api/voice/:member) handles:
  - member identification via URL path (no user_id in body)
  - raw text body parsing (no JSON encoding needed)
  - plain text response containing just the spoken_response

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
import urllib.parse


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
    build the v8 shortcut action list for a specific member.

    key design decisions (from v5-v7 diagnostic testing):
    - use --mode people-who-know-me (anyone mode strips Advanced/HTTP params)
    - API returns plain text, not JSON (Get Dictionary Value hangs after signing)
    - WFHTTPBodyType "File" sends pipeline content as POST body
    - all parameter values are static strings/bools that survive code-signing
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
    # WFURL: static string (survives signing)
    # WFHTTPBodyType "File": sends pipeline content (dictated text) as POST body
    # Advanced: True — needed for method/body options (survives people-who-know-me signing)
    actions.append(act("is.workflow.actions.downloadurl", {
        "WFURL": tts(api_url),
        "Advanced": True,
        "WFHTTPMethod": "POST",
        "WFHTTPBodyType": "File"
    }))

    # === action 4: Speak Text ===
    # the API now returns plain text (just the spoken_response)
    # so we can pipe directly to Speak Text — no dictionary extraction needed
    # WFSpeakTextWait: True — waits for speech to finish before next loop iteration
    actions.append(act("is.workflow.actions.speaktext", {
        "WFSpeakTextWait": True
    }))

    # === action 5: Repeat end ===
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

        # sign with people-who-know-me mode (NOT "anyone")
        # "anyone" mode strips Advanced/WFHTTPMethod/WFHTTPBodyType params
        # "people-who-know-me" preserves all params (fine for 6-person collective)
        signed_ok = False
        for attempt in range(2):
            result = subprocess.run(
                ["shortcuts", "sign", "--mode", "people-who-know-me",
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
    print(f"[shortcut] generated {success_count}/{len(members)} shortcuts (v8)")
    print(f"[shortcut] signing: people-who-know-me | response: plain text | 5 actions")
    print(f"[shortcut] api base: {API_BASE}/{{member}}")
    print()

    # show install URLs (properly URL-encoded)
    base_url = "https://pocket-prompts-five.vercel.app/shortcuts"
    for member_name in members:
        shortcut_url = f"{base_url}/pocket-prompts-{member_name}.shortcut"
        encoded_url = urllib.parse.quote(shortcut_url, safe='')
        install_url = f"shortcuts://import-shortcut?url={encoded_url}&name=pocket.prompts"
        print(f"  {member_name}: {install_url}")


if __name__ == "__main__":
    main()
