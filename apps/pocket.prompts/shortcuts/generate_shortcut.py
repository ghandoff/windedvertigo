#!/usr/bin/env python3
"""
generate_shortcut.py — programmatically builds the pocket.prompts iOS shortcut

generates a binary .shortcut file (plist format) that creates a conversational
voice loop: dictate → send to pocket api → hear response → dictate again.

usage:
  python3 generate_shortcut.py

output:
  shortcuts/pocket-prompts-unsigned.shortcut
"""

import plistlib
import uuid
import os

# --- config ---
API_URL = "https://pocket-prompts-five.vercel.app/api/voice"
DEFAULT_USER_ID = "garrett"
SHORTCUT_NAME = "pocket.prompts"
REPEAT_COUNT = 20
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "pocket-prompts-unsigned.shortcut")


def make_action(identifier, parameters=None):
    """create a shortcut action dict"""
    action = {
        "WFWorkflowActionIdentifier": identifier,
        "WFWorkflowActionParameters": parameters or {}
    }
    return action


def build_shortcut():
    """build the pocket.prompts shortcut action list"""

    actions = []

    # --- action 1: set user_id variable ---
    actions.append(make_action(
        "is.workflow.actions.setvariable",
        {
            "WFInput": {
                "Value": {
                    "attachmentsByRange": {},
                    "string": DEFAULT_USER_ID
                },
                "WFSerializationType": "WFTextTokenString"
            },
            "WFVariableName": "user_id"
        }
    ))

    # --- action 2: start repeat loop ---
    repeat_uuid = str(uuid.uuid4()).upper()
    actions.append(make_action(
        "is.workflow.actions.repeat.count",
        {
            "WFRepeatCount": REPEAT_COUNT,
            "GroupingIdentifier": repeat_uuid
        }
    ))

    # --- action 3: dictate text ---
    actions.append(make_action(
        "is.workflow.actions.dictatetext",
        {
            "WFDictateTextStopListening": "After Short Pause",
            "WFSpeechLanguage": "en_US"
        }
    ))

    # --- action 3b: save dictated text to variable ---
    actions.append(make_action(
        "is.workflow.actions.setvariable",
        {
            "WFVariableName": "spoken_text"
        }
    ))

    # --- action 4: check for exit phrases ---
    # if spoken_text contains "stop"
    if_uuid = str(uuid.uuid4()).upper()
    actions.append(make_action(
        "is.workflow.actions.conditional",
        {
            "GroupingIdentifier": if_uuid,
            "WFInput": {
                "Type": "Variable",
                "Variable": {
                    "Value": {
                        "Type": "Variable",
                        "VariableName": "spoken_text"
                    },
                    "WFSerializationType": "WFTextTokenAttachment"
                }
            },
            "WFCondition": 99,  # contains
            "WFConditionalActionString": "stop"
        }
    ))

    # then: exit shortcut
    actions.append(make_action(
        "is.workflow.actions.exit",
        {}
    ))

    # end if
    actions.append(make_action(
        "is.workflow.actions.conditional",
        {
            "GroupingIdentifier": if_uuid,
            "WFControlFlowMode": 2  # end if
        }
    ))

    # second if: check for "never mind"
    if_uuid2 = str(uuid.uuid4()).upper()
    actions.append(make_action(
        "is.workflow.actions.conditional",
        {
            "GroupingIdentifier": if_uuid2,
            "WFInput": {
                "Type": "Variable",
                "Variable": {
                    "Value": {
                        "Type": "Variable",
                        "VariableName": "spoken_text"
                    },
                    "WFSerializationType": "WFTextTokenAttachment"
                }
            },
            "WFCondition": 99,
            "WFConditionalActionString": "never mind"
        }
    ))

    actions.append(make_action(
        "is.workflow.actions.exit",
        {}
    ))

    actions.append(make_action(
        "is.workflow.actions.conditional",
        {
            "GroupingIdentifier": if_uuid2,
            "WFControlFlowMode": 2
        }
    ))

    # third if: check for "that's all"
    if_uuid3 = str(uuid.uuid4()).upper()
    actions.append(make_action(
        "is.workflow.actions.conditional",
        {
            "GroupingIdentifier": if_uuid3,
            "WFInput": {
                "Type": "Variable",
                "Variable": {
                    "Value": {
                        "Type": "Variable",
                        "VariableName": "spoken_text"
                    },
                    "WFSerializationType": "WFTextTokenAttachment"
                }
            },
            "WFCondition": 99,
            "WFConditionalActionString": "that's all"
        }
    ))

    actions.append(make_action(
        "is.workflow.actions.exit",
        {}
    ))

    actions.append(make_action(
        "is.workflow.actions.conditional",
        {
            "GroupingIdentifier": if_uuid3,
            "WFControlFlowMode": 2
        }
    ))

    # --- action 5: POST to pocket api ---
    # build the json body with variables
    actions.append(make_action(
        "is.workflow.actions.downloadurl",
        {
            "WFURL": {
                "Value": {
                    "attachmentsByRange": {},
                    "string": API_URL
                },
                "WFSerializationType": "WFTextTokenString"
            },
            "WFHTTPMethod": "POST",
            "WFHTTPHeaders": {
                "Value": {
                    "WFDictionaryFieldValueItems": [
                        {
                            "WFItemType": 0,
                            "WFKey": {
                                "Value": {
                                    "attachmentsByRange": {},
                                    "string": "Content-Type"
                                },
                                "WFSerializationType": "WFTextTokenString"
                            },
                            "WFValue": {
                                "Value": {
                                    "attachmentsByRange": {},
                                    "string": "application/json"
                                },
                                "WFSerializationType": "WFTextTokenString"
                            }
                        }
                    ]
                },
                "WFSerializationType": "WFDictionaryFieldValue"
            },
            "WFHTTPBodyType": "JSON",
            "WFJSONValues": {
                "Value": {
                    "WFDictionaryFieldValueItems": [
                        {
                            "WFItemType": 0,
                            "WFKey": {
                                "Value": {
                                    "attachmentsByRange": {},
                                    "string": "text"
                                },
                                "WFSerializationType": "WFTextTokenString"
                            },
                            "WFValue": {
                                "Value": {
                                    "attachmentsByRange": {
                                        "{0, 1}": {
                                            "Type": "Variable",
                                            "VariableName": "spoken_text"
                                        }
                                    },
                                    "string": "\uFFFC"
                                },
                                "WFSerializationType": "WFTextTokenString"
                            }
                        },
                        {
                            "WFItemType": 0,
                            "WFKey": {
                                "Value": {
                                    "attachmentsByRange": {},
                                    "string": "user_id"
                                },
                                "WFSerializationType": "WFTextTokenString"
                            },
                            "WFValue": {
                                "Value": {
                                    "attachmentsByRange": {
                                        "{0, 1}": {
                                            "Type": "Variable",
                                            "VariableName": "user_id"
                                        }
                                    },
                                    "string": "\uFFFC"
                                },
                                "WFSerializationType": "WFTextTokenString"
                            }
                        }
                    ]
                },
                "WFSerializationType": "WFDictionaryFieldValue"
            }
        }
    ))

    # --- action 5b: save api response to variable ---
    actions.append(make_action(
        "is.workflow.actions.setvariable",
        {
            "WFVariableName": "api_response"
        }
    ))

    # --- action 6: get dictionary value (spoken_response) ---
    actions.append(make_action(
        "is.workflow.actions.getvalueforkey",
        {
            "WFInput": {
                "Type": "Variable",
                "Variable": {
                    "Value": {
                        "Type": "Variable",
                        "VariableName": "api_response"
                    },
                    "WFSerializationType": "WFTextTokenAttachment"
                }
            },
            "WFDictionaryKey": "spoken_response"
        }
    ))

    # --- action 6b: save response text to variable ---
    actions.append(make_action(
        "is.workflow.actions.setvariable",
        {
            "WFVariableName": "response_text"
        }
    ))

    # --- action 7: speak the response ---
    actions.append(make_action(
        "is.workflow.actions.speaktext",
        {
            "WFText": {
                "Value": {
                    "attachmentsByRange": {
                        "{0, 1}": {
                            "Type": "Variable",
                            "VariableName": "response_text"
                        }
                    },
                    "string": "\uFFFC"
                },
                "WFSerializationType": "WFTextTokenString"
            },
            "WFSpeakTextLanguage": "en-US",
            "WFSpeakTextWait": True
        }
    ))

    # --- action 8: end repeat ---
    actions.append(make_action(
        "is.workflow.actions.repeat.count",
        {
            "GroupingIdentifier": repeat_uuid,
            "WFControlFlowMode": 2  # end repeat
        }
    ))

    return actions


def main():
    actions = build_shortcut()

    # build the full shortcut plist
    shortcut = {
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowMinimumClientVersionString": "900",
        "WFWorkflowIcon": {
            "WFWorkflowIconStartColor": 4282601983,  # blue
            "WFWorkflowIconGlyphNumber": 59771  # microphone glyph
        },
        "WFWorkflowClientVersion": "2612.0.4",
        "WFWorkflowClientRelease": "2612.0.4",
        "WFWorkflowTypes": ["NCWidget", "WatchKit", "ActionExtension"],
        "WFWorkflowInputContentItemClasses": [
            "WFStringContentItem",
            "WFGenericFileContentItem"
        ],
        "WFWorkflowImportQuestions": [],
        "WFWorkflowActions": actions,
        "WFWorkflowHasShortcutInputVariables": False
    }

    # write the binary plist
    with open(OUTPUT_FILE, "wb") as f:
        plistlib.dump(shortcut, f, fmt=plistlib.FMT_BINARY)

    print(f"[shortcut] generated: {OUTPUT_FILE}")
    print(f"[shortcut] actions: {len(actions)}")
    print(f"[shortcut] api url: {API_URL}")
    print(f"[shortcut] default user: {DEFAULT_USER_ID}")
    print()
    print("next steps:")
    print(f"  1. sign:  shortcuts sign --mode anyone --input '{OUTPUT_FILE}' --output '{OUTPUT_FILE.replace('-unsigned', '')}'")
    print(f"  2. host the signed file on vercel (public/shortcuts/)")
    print(f"  3. share: shortcuts://import-shortcut?url=<hosted-url>&name={SHORTCUT_NAME}")


if __name__ == "__main__":
    main()
