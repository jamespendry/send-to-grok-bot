#!/usr/bin/env python3
# Builds shortcuts/Send to Grok Bot.shortcut (unsigned XML source).
# Re-sign after building; see BUILD.md. Run: python3 shortcuts/build.py
#
# The shortcut needs no code. It sends the shared post link and the chosen AI to
# relay.sendtogrokbot.com/v1/open, which answers in plain text with a link that
# opens that AI with the post filled in. For Grok Bot it answers with the message
# to send; the shortcut opens the share sheet so the person picks Grok Bot and a chat.
import plistlib, uuid
from pathlib import Path

OBJ = "￼"

def var(name):
    return {"Value": {"Type": "Variable", "VariableName": name}, "WFSerializationType": "WFTextTokenAttachment"}

def text_with(name):
    return {"Value": {"string": OBJ, "attachmentsByRange": {"{0, 1}": {"Type": "Variable", "VariableName": name}}},
            "WFSerializationType": "WFTextTokenString"}

def plain(s):
    return {"Value": {"string": s}, "WFSerializationType": "WFTextTokenString"}

def act(ident, **params):
    return {"WFWorkflowActionIdentifier": "is.workflow.actions." + ident, "WFWorkflowActionParameters": params}

def setvar(name):
    return act("setvariable", WFVariableName=name)

def if_has_value(name, group):
    return act("conditional", GroupingIdentifier=group, WFControlFlowMode=0, WFCondition=100,
               WFInput={"Type": "Variable", "Variable": var(name)})

def otherwise(group):
    return act("conditional", GroupingIdentifier=group, WFControlFlowMode=1)

def end_if(group):
    return act("conditional", GroupingIdentifier=group, WFControlFlowMode=2)

def gid():
    return str(uuid.uuid4()).upper()

# Codex is left out: on iPhone it lives inside the ChatGPT app, which does not open
# Codex links, so it would land on the website. It stays in the Chrome extension.
MENU = [("Grok Bot", "grokbot"), ("Claude", "claude"), ("ChatGPT", "chatgpt")]

def shared_input():
    return {"Value": {"string": OBJ, "attachmentsByRange": {"{0, 1}": {"Type": "ExtensionInput"}}},
            "WFSerializationType": "WFTextTokenString"}

def output_of(action, name):
    # Wire an action's input to an earlier action's output by that action's UUID.
    # iOS does not fill a missing input in, so every input is named.
    return {"Value": {"Type": "ActionOutput", "OutputName": name, "OutputUUID": action["WFWorkflowActionParameters"]["UUID"]},
            "WFSerializationType": "WFTextTokenAttachment"}

def text_of(action, name):
    # The same wiring as output_of, inside a text field.
    return {"Value": {"string": OBJ, "attachmentsByRange": {"{0, 1}": {"Type": "ActionOutput", "OutputName": name,
            "OutputUUID": action["WFWorkflowActionParameters"]["UUID"]}}}, "WFSerializationType": "WFTextTokenString"}

def with_uuid(action):
    action["WFWorkflowActionParameters"]["UUID"] = gid()
    return action

def ask_relay(dest, fmt):
    # The relay answers in plain text: the link to open, or the message to paste.
    return with_uuid(act("downloadurl", WFURL="https://relay.sendtogrokbot.com/v1/open", WFHTTPMethod="POST", WFHTTPBodyType="JSON",
        ShowHeaders=False,
        WFJSONValues={"Value": {"WFDictionaryFieldValueItems": [
            {"WFItemType": 0, "WFKey": plain("destination"), "WFValue": plain(dest)},
            {"WFItemType": 0, "WFKey": plain("url"), "WFValue": shared_input()},
            {"WFItemType": 0, "WFKey": plain("source"), "WFValue": plain("shortcut")},
            {"WFItemType": 0, "WFKey": plain("format"), "WFValue": plain(fmt)},
        ]}, "WFSerializationType": "WFDictionaryFieldValue"}))

def send_steps(dest):
    # No If blocks, no variables, no link check. The relay finds the post link in whatever the X app shared.
    if dest == "grokbot":
        # Grok Bot has no documented link into a chat (grokbot:// only opens its home screen).
        # Its documented route is the share sheet: Grok Bot, pick a chat, Attach. The message
        # is also copied, as a fallback if the person picks a different app.
        get = ask_relay(dest, "copy")
        # The relay's answer arrives as a file named "open". Turn it into plain text first,
        # or the share sheet offers a "Text Document" that Grok Bot does not accept.
        msg = with_uuid(act("gettext", WFTextActionText=text_of(get, "Contents of URL")))
        return [get, msg,
                act("setclipboard", WFInput=output_of(msg, "Text")),
                act("share", WFInput=output_of(msg, "Text"))]
    get = ask_relay(dest, "text")
    return [get, act("openurl", WFInput=output_of(get, "Contents of URL"))]

def build():
    menu = gid()
    a = [act("choosefrommenu", GroupingIdentifier=menu, WFControlFlowMode=0, WFMenuPrompt="Send this post to",
             WFMenuItems=[t for t, _ in MENU])]
    for title, dest in MENU:
        a.append(act("choosefrommenu", GroupingIdentifier=menu, WFControlFlowMode=1, WFMenuItemTitle=title))
        a += send_steps(dest)
    a.append(act("choosefrommenu", GroupingIdentifier=menu, WFControlFlowMode=2))
    return {
        "WFWorkflowName": "Send to Grok Bot",
        "WFWorkflowClientVersion": "2700.0.1",
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowMinimumClientVersionString": "900",
        "WFWorkflowIcon": {"WFWorkflowIconStartColor": 255, "WFWorkflowIconGlyphNumber": 59836},
        "WFWorkflowTypes": ["ActionExtension"],
        "WFWorkflowInputContentItemClasses": ["WFURLContentItem", "WFStringContentItem", "WFSafariWebPageContentItem"],
        "WFWorkflowHasShortcutInputVariables": True,
        "WFWorkflowImportQuestions": [],
        "WFWorkflowActions": a,
    }

if __name__ == "__main__":
    out = Path(__file__).with_name("Send to Grok Bot.shortcut")
    out.write_bytes(plistlib.dumps(build(), fmt=plistlib.FMT_XML))
    print("wrote", out)
