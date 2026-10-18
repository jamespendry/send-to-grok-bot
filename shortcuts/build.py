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

def build():
    has_link, menu, copy, opener = gid(), gid(), gid(), gid()
    a = [
        act("detect.link", WFInput={"Value": {"Type": "ExtensionInput"}, "WFSerializationType": "WFTextTokenAttachment"}),
        setvar("Links"),
        if_has_value("Links", has_link),
        act("getitemfromlist", WFItemSpecifier="First Item", WFInput=var("Links")),
        setvar("Post URL"),
        act("choosefrommenu", GroupingIdentifier=menu, WFControlFlowMode=0, WFMenuPrompt="Send this post to",
            WFMenuItems=[t for t, _ in MENU]),
    ]
    for title, dest in MENU:
        a += [act("choosefrommenu", GroupingIdentifier=menu, WFControlFlowMode=1, WFMenuItemTitle=title),
              act("gettext", WFTextActionText=dest),
              setvar("Destination")]
    a += [
        act("choosefrommenu", GroupingIdentifier=menu, WFControlFlowMode=2),
        act("downloadurl", WFURL="https://relay.sendtogrokbot.com/v1/open", WFHTTPMethod="POST", WFHTTPBodyType="JSON",
            WFJSONValues={"Value": {"WFDictionaryFieldValueItems": [
                {"WFItemType": 0, "WFKey": plain("destination"), "WFValue": text_with("Destination")},
                {"WFItemType": 0, "WFKey": plain("url"), "WFValue": text_with("Post URL")},
                {"WFItemType": 0, "WFKey": plain("source"), "WFValue": plain("shortcut")},
            ]}, "WFSerializationType": "WFDictionaryFieldValue"}),
        act("detect.dictionary"),
        setvar("Response"),
        act("getvalueforkey", WFDictionaryKey="copyText", WFInput=var("Response")),
        setvar("Copy Text"),
        if_has_value("Copy Text", copy),
        act("setclipboard", WFInput=var("Copy Text")),
        end_if(copy),
        act("getvalueforkey", WFDictionaryKey="notice", WFInput=var("Response")),
        setvar("Notice"),
        act("notification", WFNotificationActionTitle="Send to Grok Bot", WFNotificationActionBody=text_with("Notice")),
        act("getvalueforkey", WFDictionaryKey="openUrl", WFInput=var("Response")),
        setvar("Open URL"),
        if_has_value("Open URL", opener),
        act("openurl", WFInput=var("Open URL")),
        end_if(opener),
        otherwise(has_link),
        act("notification", WFNotificationActionTitle="Send to Grok Bot",
            WFNotificationActionBody=plain("Share a post from the X app, then pick Send to Grok Bot.")),
        end_if(has_link),
    ]
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
