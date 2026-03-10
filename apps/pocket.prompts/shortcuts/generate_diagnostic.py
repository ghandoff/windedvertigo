#!/usr/bin/env python3
"""
generate_diagnostic.py — builds diagnostic shortcuts to isolate pipeline breaks

creates 5 shortcuts with increasing complexity:
  level 0: Text → Show Alert (does the shortcut run at all?)
  level 1: GET URL → Show Alert (does network + pipeline work?)
  level 2: POST URL → Get Dict Value → Show Alert (does JSON extraction work?)
  level 3: Dictate → POST (File body) → Get Dict → Speak (full pipeline, no loop)
  level 4: Full repeat loop with real API (production config)

uses Show Alert (visual popup) for levels 0-2 so we can test on macOS.
levels 3-4 use Speak Text since they need iOS for dictation anyway.

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


def build_level_0():
    """
    level 0: Text → Show Alert
    tests: does the shortcut execute at all? does pipeline flow work?
    expected: shows popup alert with "shortcut is running"
    """
    return [
        # creates static text on the pipeline
        act("is.workflow.actions.gettext", {
            "WFTextActionText": tts("shortcut is running")
        }),
        # show alert with the pipeline text
        act("is.workflow.actions.alert", {
            "WFAlertActionMessage": tts("shortcut is running"),
            "WFAlertActionTitle": tts("diag-0"),
        }),
    ]


def build_level_1():
    """
    level 1: GET → Show Alert
    tests: does Get Contents of URL actually fetch data?
    expected: shows popup with "echo test successful. the pipeline works."
    """
    return [
        act("is.workflow.actions.downloadurl", {
            "WFURL": tts(API_BASE),
        }),
        # show what Get Contents returned via an alert
        # the pipeline content should be the response body
        # Show Result will display whatever is on the pipeline
        act("is.workflow.actions.showresult", {
            "WFText": tts("request complete")
        }),
    ]


def build_level_1b():
    """
    level 1b: GET → Speak Text (same as original level 1 but kept for iOS test)
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
    level 2: POST → Get Dict Value → Show Result
    tests: does JSON auto-parse + Get Dictionary Value work?
    expected: shows "echo test successful. the post pipeline works."
    """
    return [
        act("is.workflow.actions.downloadurl", {
            "WFURL": tts(API_BASE),
            "Advanced": True,
            "WFHTTPMethod": "POST",
        }),
        act("is.workflow.actions.getvalueforkey", {
            "WFGetDictionaryValueType": "Value",
            "WFDictionaryKey": tts("spoken_response")
        }),
        act("is.workflow.actions.showresult", {
            "WFText": tts("extracted value above")
        }),
    ]


def build_level_3():
    """
    level 3: Dictate → POST (File body) → Get Dict → Speak Text
    one-shot, no loop. tests body delivery.
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
            "WFDictionaryKey": tts("spoken_response")
        }),
        act("is.workflow.actions.speaktext", {
            "WFSpeakTextWait": True
        }),
    ]


def build_level_4():
    """
    level 4: full repeat loop with real API (production config, 3 iterations)
    """
    repeat_group = make_uuid()
    return [
        act("is.workflow.actions.repeat.count", {
            "GroupingIdentifier": repeat_group,
            "WFControlFlowMode": 0,
            "WFRepeatCount": 3
        }),
        act("is.workflow.actions.dictatetext", {
            "WFDictateTextStopListening": "After Short Pause",
            "WFSpeechLanguage": "en-US"
        }),
        act("is.workflow.actions.downloadurl", {
            "WFURL": tts("https://pocket-prompts-five.vercel.app/api/voice/garrett"),
            "Advanced": True,
            "WFHTTPMethod": "POST",
            "WFHTTPBodyType": "File"
        }),
        act("is.workflow.actions.getvalueforkey", {
            "WFGetDictionaryValueType": "Value",
            "WFDictionaryKey": tts("spoken_response")
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
    0: ("Text → Alert (does shortcut run?)", build_level_0),
    1: ("GET → Show Result (does fetch work?)", build_level_1),
    2: ("POST → Get Dict → Show Result (JSON extraction)", build_level_2),
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
    print("[diagnostic] to test on macOS, import the shortcut file:")
    for level, (desc, _) in LEVELS.items():
        path = os.path.join(OUTPUT_DIR, f"diag-{level}.shortcut")
        print(f"  open '{path}'")
        print(f"    → {desc}")


if __name__ == "__main__":
    main()
