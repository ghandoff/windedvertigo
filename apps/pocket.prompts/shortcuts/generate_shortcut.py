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

# unicode object replacement character — placeholder for variables in text
OBJECT_REPLACEMENT = "\uFFFC"


def make_uuid():
    """generate an uppercase UUID"""
    return str(uuid.uuid4()).upper()


def make_action(identifier, parameters=None):
    """create a shortcut action dict"""
    return {
        "WFWorkflowActionIdentifier": identifier,
        "WFWorkflowActionParameters": parameters or {}
    }


def make_text_token_string(text, attachments=None):
    """build a WFTextTokenString serialization"""
    value = {
        "attachmentsByRange": attachments or {},
        "string": text
    }
    return {
        "Value": value,
        "WFSerializationType": "WFTextTokenString"
    }


def make_text_token_attachment(type_name, **kwargs):
    """build a WFTextTokenAttachment serialization"""
    value = {"Type": type_name}
    value.update(kwargs)
    return {
        "Value": value,
        "WFSerializationType": "WFTextTokenAttachment"
    }


def make_dict_field_item(key_str, value_str=None, value_attachment=None, item_type=0):
    """build a single WFDictionaryFieldValueItem"""
    item = {
        "WFItemType": item_type,
        "WFKey": make_text_token_string(key_str)
    }
    if value_attachment:
        item["WFValue"] = value_attachment
    elif value_str is not None:
        item["WFValue"] = make_text_token_string(value_str)
    return item


def build_shortcut():
    """build the pocket.prompts shortcut action list"""

    actions = []

    # UUIDs for actions that produce output (magic variables)
    text_uuid = make_uuid()       # text action for user_id
    dictate_uuid = make_uuid()    # dictate text action
    api_uuid = make_uuid()        # get contents of url (POST)
    dict_val_uuid = make_uuid()   # get dictionary value

    # grouping UUIDs for control flow
    repeat_group = make_uuid()
    if_stop_group = make_uuid()
    if_nevermind_group = make_uuid()
    if_thatsall_group = make_uuid()

    # === action 1: Text (set the user_id string) ===
    actions.append(make_action(
        "is.workflow.actions.gettext",
        {
            "UUID": text_uuid,
            "WFTextActionText": make_text_token_string(DEFAULT_USER_ID)
        }
    ))

    # === action 2: Set Variable (store user_id) ===
    actions.append(make_action(
        "is.workflow.actions.setvariable",
        {
            "WFVariableName": "user_id"
        }
    ))

    # === action 3: Repeat start ===
    actions.append(make_action(
        "is.workflow.actions.repeat.count",
        {
            "GroupingIdentifier": repeat_group,
            "WFControlFlowMode": 0,
            "WFRepeatCount": REPEAT_COUNT
        }
    ))

    # === action 4: Dictate Text ===
    actions.append(make_action(
        "is.workflow.actions.dictatetext",
        {
            "UUID": dictate_uuid,
            "WFDictateTextStopListening": "After Short Pause",
            "WFSpeechLanguage": "en-US"
        }
    ))

    # === action 5: Set Variable (store spoken_text) ===
    actions.append(make_action(
        "is.workflow.actions.setvariable",
        {
            "WFVariableName": "spoken_text"
        }
    ))

    # === action 6: If "stop" — exit ===
    # if start
    actions.append(make_action(
        "is.workflow.actions.conditional",
        {
            "GroupingIdentifier": if_stop_group,
            "WFControlFlowMode": 0,
            "WFInput": make_text_token_attachment(
                "ActionOutput",
                OutputName="Dictated Text",
                OutputUUID=dictate_uuid
            ),
            "WFCondition": 1,  # contains
            "WFConditionalActionString": "stop"
        }
    ))

    # exit
    actions.append(make_action("is.workflow.actions.exit", {}))

    # otherwise (mode 1) — skip for just if/end
    actions.append(make_action(
        "is.workflow.actions.conditional",
        {
            "GroupingIdentifier": if_stop_group,
            "WFControlFlowMode": 1
        }
    ))

    # end if
    actions.append(make_action(
        "is.workflow.actions.conditional",
        {
            "GroupingIdentifier": if_stop_group,
            "WFControlFlowMode": 2
        }
    ))

    # === action 7: If "never mind" — exit ===
    actions.append(make_action(
        "is.workflow.actions.conditional",
        {
            "GroupingIdentifier": if_nevermind_group,
            "WFControlFlowMode": 0,
            "WFInput": make_text_token_attachment(
                "ActionOutput",
                OutputName="Dictated Text",
                OutputUUID=dictate_uuid
            ),
            "WFCondition": 1,
            "WFConditionalActionString": "never mind"
        }
    ))

    actions.append(make_action("is.workflow.actions.exit", {}))

    actions.append(make_action(
        "is.workflow.actions.conditional",
        {
            "GroupingIdentifier": if_nevermind_group,
            "WFControlFlowMode": 1
        }
    ))

    actions.append(make_action(
        "is.workflow.actions.conditional",
        {
            "GroupingIdentifier": if_nevermind_group,
            "WFControlFlowMode": 2
        }
    ))

    # === action 8: If "that's all" — exit ===
    actions.append(make_action(
        "is.workflow.actions.conditional",
        {
            "GroupingIdentifier": if_thatsall_group,
            "WFControlFlowMode": 0,
            "WFInput": make_text_token_attachment(
                "ActionOutput",
                OutputName="Dictated Text",
                OutputUUID=dictate_uuid
            ),
            "WFCondition": 1,
            "WFConditionalActionString": "that's all"
        }
    ))

    actions.append(make_action("is.workflow.actions.exit", {}))

    actions.append(make_action(
        "is.workflow.actions.conditional",
        {
            "GroupingIdentifier": if_thatsall_group,
            "WFControlFlowMode": 1
        }
    ))

    actions.append(make_action(
        "is.workflow.actions.conditional",
        {
            "GroupingIdentifier": if_thatsall_group,
            "WFControlFlowMode": 2
        }
    ))

    # === action 9: Get Variable (spoken_text for API body) ===
    actions.append(make_action(
        "is.workflow.actions.getvariable",
        {
            "WFVariable": make_text_token_attachment(
                "Variable",
                VariableName="spoken_text"
            )
        }
    ))

    # === action 10: URL (set the API endpoint) ===
    actions.append(make_action(
        "is.workflow.actions.url",
        {
            "WFURLActionURL": API_URL
        }
    ))

    # === action 11: Get Contents of URL (POST to API) ===
    # build the JSON body with variable references
    text_value_with_var = make_text_token_string(
        OBJECT_REPLACEMENT,
        {
            "{0, 1}": {
                "OutputName": "Dictated Text",
                "OutputUUID": dictate_uuid,
                "Type": "ActionOutput"
            }
        }
    )

    user_id_value_with_var = make_text_token_string(
        OBJECT_REPLACEMENT,
        {
            "{0, 1}": {
                "Type": "Variable",
                "VariableName": "user_id"
            }
        }
    )

    actions.append(make_action(
        "is.workflow.actions.downloadurl",
        {
            "UUID": api_uuid,
            "Advanced": True,
            "WFHTTPMethod": "POST",
            "WFHTTPBodyType": "JSON",
            "WFJSONValues": {
                "Value": {
                    "WFDictionaryFieldValueItems": [
                        {
                            "WFItemType": 0,
                            "WFKey": make_text_token_string("text"),
                            "WFValue": text_value_with_var
                        },
                        {
                            "WFItemType": 0,
                            "WFKey": make_text_token_string("user_id"),
                            "WFValue": user_id_value_with_var
                        }
                    ]
                },
                "WFSerializationType": "WFDictionaryFieldValue"
            },
            "ShowHeaders": True,
            "WFHTTPHeaders": {
                "Value": {
                    "WFDictionaryFieldValueItems": [
                        {
                            "WFItemType": 0,
                            "WFKey": make_text_token_string("Content-Type"),
                            "WFValue": make_text_token_string("application/json")
                        }
                    ]
                },
                "WFSerializationType": "WFDictionaryFieldValue"
            }
        }
    ))

    # === action 12: Get Dictionary Value (extract spoken_response) ===
    actions.append(make_action(
        "is.workflow.actions.getvalueforkey",
        {
            "UUID": dict_val_uuid,
            "WFGetDictionaryValueType": "Value",
            "WFDictionaryKey": "spoken_response"
        }
    ))

    # === action 13: Speak Text ===
    actions.append(make_action(
        "is.workflow.actions.speaktext",
        {
            "WFSpeakTextWait": True
        }
    ))

    # === action 14: Repeat end ===
    actions.append(make_action(
        "is.workflow.actions.repeat.count",
        {
            "GroupingIdentifier": repeat_group,
            "WFControlFlowMode": 2
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
        "WFWorkflowClientVersion": "2302.0.4",
        "WFWorkflowClientRelease": "2302.0.4",
        "WFWorkflowTypes": ["NCWidget", "WatchKit"],
        "WFWorkflowInputContentItemClasses": [
            "WFStringContentItem"
        ],
        "WFWorkflowOutputContentItemClasses": [],
        "WFWorkflowImportQuestions": [],
        "WFWorkflowActions": actions,
        "WFWorkflowHasShortcutInputVariables": False,
        "WFWorkflowHasOutputFallback": False
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
