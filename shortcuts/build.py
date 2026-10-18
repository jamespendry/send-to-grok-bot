#!/usr/bin/env python3
# Builds shortcuts/Send to Grok Bot.shortcut (unsigned XML source).
# Re-sign after building; see BUILD.md. Run: python3 shortcuts/build.py
#
# The shortcut needs no code. It sends the shared post link and the chosen AI to
# relay.sendtogrokbot.com/v1/open, which returns a link that opens that AI with
# the post filled in. For Grok Bot it returns text to copy and opens the app.
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

MENU = [("Grok Bot", "grokbot"), ("Claude", "claude"), ("ChatGPT", "chatgpt"), ("Codex", "codex")]

def shared_input():
    return {"Value": {"string": OBJ, "attachmentsByRange": {"{0, 1}": {"Type": "ExtensionInput"}}},
            "WFSerializationType": "WFTextTokenString"}

def send_steps(dest):
    # No If blocks and no link check: the X app shares a link, a page, or text,
    # and the relay finds the post link in whatever arrives.
    steps = [
        act("downloadurl", WFURL="https://relay.sendtogrokbot.com/v1/open", WFHTTPMethod="POST", WFHTTPBodyType="JSON",
            WFJSONValues={"Value": {"WFDictionaryFieldValueItems": [
                {"WFItemType": 0, "WFKey": plain("destination"), "WFValue": plain(dest)},
                {"WFItemType": 0, "WFKey": plain("url"), "WFValue": shared_input()},
                {"WFItemType": 0, "WFKey": plain("source"), "WFValue": plain("shortcut")},
            ]}, "WFSerializationType": "WFDictionaryFieldValue"}),
        act("detect.dictionary"),
        setvar("Response"),
        act("getvalueforkey", WFDictionaryKey="notice", WFInput=var("Response")),
        setvar("Notice"),
        act("notification", WFNotificationActionTitle="Send to Grok Bot", WFNotificationActionBody=text_with("Notice")),
    ]
    if dest == "grokbot":
        steps += [act("getvalueforkey", WFDictionaryKey="copyText", WFInput=var("Response")),
                  setvar("Copy Text"),
                  act("setclipboard", WFInput=var("Copy Text"))]
    steps += [act("getvalueforkey", WFDictionaryKey="openUrl", WFInput=var("Response")),
              setvar("Open URL"),
              act("openurl", WFInput=var("Open URL"))]
    return steps

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
        "WFWorkflowIcon": {"WFWorkflowIconStartColor": 431817727, "WFWorkflowIconGlyphNumber": 59511},
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
