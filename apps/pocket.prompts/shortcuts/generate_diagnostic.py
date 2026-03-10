#!/usr/bin/env python3
"""
generate_diagnostic.py — builds diagnostic shortcuts to isolate pipeline breaks

creates 4 shortcuts with increasing complexity:
  level 1: GET → Speak Text (plain text response, no dictation)
  level 2: GET → Get Dict Value → Speak Text (JSON response, no dictation)
  level 3: Dictate → POST (File body) → Get Dict Value → Speak Text (full pipeline, no loop)
  level 4: Dictate → POST (JSON body via Form) → Get Dict Value → Speak Text

if level 1 fails: pipeline itself is broken by signing (Speak Text can't read pipeline)
if level 2 fails: Get Dictionary Value doesn't work after signing
if level 3 fails: WFHTTPBodyType "File" doesn't work or POST breaks pipeline
if level 4 fails: all body approaches are broken

usage:
  python3 shortcuts/generate_diagnostic.py

output:
  public/shortcuts/diag-{level}.shortcut
"""

import plistlib
import uuid
import os
import subprocess


API_BASE = "https://pocket-prompts-five.vercel.app/api/echo"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
OUTPUT_DIR = os.path.join(PROJECT_DIR, "public", "shortcuts")


def make_uuid():
    return str(uuid.uuid4()).upper()


def act(identifier, parameters=None):
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


def build_level_1():
    """
    level 1: GET → Speak Text
    tests: does the pipeline flow from Get Contents to Speak Text?
    expected: speaks "echo test successful. the pipeline works."
    """
    return [
        act("is.workflow.actions.downloadurl", {
            "WFURL": tts(API_BASE),
        }),
        act("is.workflow.actions.speaktext", {
            "WFSpeakTextWait": True
        }),
    ]


def build_level_2():
    """
    level 2: GET → Get Dict Value → Speak Text
    but wait — GET returns plain text, not JSON. let me use a query param.
    actually, let's add ?format=json to get JSON response.

    revised: POST (no body) → Get Dict Value → Speak Text
    tests: does Get Dictionary Value extract from auto-parsed JSON?
    expected: speaks "echo test successful. the post pipeline works."
    """
    return [
        act("is.workflow.actions.downloadurl", {
            "WFURL": tts(API_BASE),
            "Advanced": True,
            "WFHTTPMethod": "POST",
        }),
        act("is.workflow.actions.getvalueforkey", {
            "WFGetDictionaryValueType": "Value",
            "WFDictionaryKey": "spoken_response"
        }),
        act("is.workflow.actions.speaktext", {
            "WFSpeakTextWait": True
        }),
    ]


def build_level_3():
    """
    level 3: Dictate → POST (File body) → Get Dict Value → Speak Text
    tests: does WFHTTPBodyType "File" send pipeline content as POST body?
    expected: speaks "echo test successful. the post pipeline works."
    """
    return [
        act("is.workflow.actions.dictatetext", {
            "WFDictateTextStopListening": "After Short Pause",
            "WFSpeechLanguage": "en-US"
        }),
        act("is.workflow.actions.downloadurl", {
            "WFURL": tts(API_BASE),
            "Advanced": True,
            "WFHTTPMethod": "POST",
            "WFHTTPBodyType": "File"
        }),
        act("is.workflow.actions.getvalueforkey", {
            "WFGetDictionaryValueType": "Value",
            "WFDictionaryKey": "spoken_response"
        }),
        act("is.workflow.actions.speaktext", {
            "WFSpeakTextWait": True
        }),
    ]


def build_level_4():
    """
    level 4: same as level 3 but with the full repeat loop (production config)
    tests: does the repeat loop interfere?
    expected: speaks response, then dictates again
    """
    repeat_group = make_uuid()
    return [
        act("is.workflow.actions.repeat.count", {
            "GroupingIdentifier": repeat_group,
            "WFControlFlowMode": 0,
            "WFRepeatCount": 3  # just 3 iterations for testing
        }),
        act("is.workflow.actions.dictatetext", {
            "WFDictateTextStopListening": "After Short Pause",
            "WFSpeechLanguage": "en-US"
        }),
        act("is.workflow.actions.downloadurl", {
            "WFURL": tts(f"https://pocket-prompts-five.vercel.app/api/voice/garrett"),
            "Advanced": True,
            "WFHTTPMethod": "POST",
            "WFHTTPBodyType": "File"
        }),
        act("is.workflow.actions.getvalueforkey", {
            "WFGetDictionaryValueType": "Value",
            "WFDictionaryKey": "spoken_response"
        }),
        act("is.workflow.actions.speaktext", {
            "WFSpeakTextWait": True
        }),
        act("is.workflow.actions.repeat.count", {
            "GroupingIdentifier": repeat_group,
            "WFControlFlowMode": 2
        }),
    ]


def build_plist(actions):
    return {
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowMinimumClientVersionString": "900",
        "WFWorkflowIcon": {
            "WFWorkflowIconStartColor": 4282601983,
            "WFWorkflowIconGlyphNumber": 59771
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


LEVELS = {
    1: ("GET → Speak (plain text pipeline)", build_level_1),
    2: ("POST → Get Dict → Speak (JSON pipeline)", build_level_2),
    3: ("Dictate → POST File → Get Dict → Speak (body delivery)", build_level_3),
    4: ("Full loop with real API (production)", build_level_4),
}


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    for level, (desc, builder) in LEVELS.items():
        actions = builder()
        plist = build_plist(actions)

        unsigned = os.path.join(SCRIPT_DIR, f"diag-{level}-unsigned.shortcut")
        signed = os.path.join(OUTPUT_DIR, f"diag-{level}.shortcut")

        with open(unsigned, "wb") as f:
            plistlib.dump(plist, f, fmt=plistlib.FMT_BINARY)

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
                print(f"  ! level {level}: sign attempt 1 failed, retrying...")

        if os.path.exists(unsigned):
            os.remove(unsigned)

        status = "✓" if signed_ok else "✗"
        print(f"  {status} level {level}: {desc}")
        print(f"    {len(actions)} actions → {os.path.basename(signed)}")

    print()
    print("[diagnostic] install URLs:")
    base = "https://pocket-prompts-five.vercel.app/shortcuts"
    for level, (desc, _) in LEVELS.items():
        url = f"{base}/diag-{level}.shortcut"
        install = f"shortcuts://import-shortcut?url={url}&name=diag-{level}"
        print(f"  level {level}: {install}")
        print(f"    → {desc}")


if __name__ == "__main__":
    main()
