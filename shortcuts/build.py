#!/usr/bin/env python3
# Builds shortcuts/Send to Grok Bot.shortcut (unsigned XML source).
# Re-sign after building; see BUILD.md. Run: python3 shortcuts/build.py
#
# Setup happens on sendtogrokbot.com/mobile. Its Finish button copies a connect code and
# runs this shortcut with the clipboard as input; the shortcut saves the code to a file
# in the Shortcuts folder of iCloud Drive and says it is connected.
# When sharing a post, it reads that file. With a code it sends the post to
# relay.sendtogrokbot.com/v1/send, which adds the full context and posts it to the
# person's Grok Bot webhook, so the person never leaves X.
# With no code it asks which AI, then sends the link to /v1/open, which answers in
# plain text: a link that opens Claude or ChatGPT with the post filled in, or, for
# Grok Bot, the message, which the shortcut copies before opening Grok Bot.
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
    # No variables and no link check. The relay finds the post link in whatever the X app shared.
    if dest == "grokbot":
        # Grok Bot has no link into a chat (grokbot:// opens its home screen), so the message is copied.
        get = ask_relay(dest, "copy")
        # The relay's answer arrives as a file named "open". Get Text from Input copies it as plain text.
        msg = with_uuid(act("detect.text", WFInput=output_of(get, "Contents of URL")))
        home = with_uuid(act("gettext", WFTextActionText=plain("grokbot://")))
        return [get, msg,
                act("setclipboard", WFInput=output_of(msg, "Text")),
                act("notification", WFNotificationActionTitle=plain("Copied"),
                    WFNotificationActionBody=plain("In Grok Bot, open a chat, then paste and send.")),
                home, act("openurl", WFInput=output_of(home, "Text"))]
    get = ask_relay(dest, "text")
    return [get, act("openurl", WFInput=output_of(get, "Contents of URL"))]

CODE_FILE = "Send to Grok Bot/connect-code.txt"
CODE_MARK = "stgbr1."

def if_contains(action, name, text, group):
    return act("conditional", GroupingIdentifier=group, WFControlFlowMode=0, WFCondition=99,
               WFConditionalActionString=text, WFInput={"Type": "Variable", "Variable": output_of(action, name)})

def send_in_background(code):
    # The connect code goes in the Authorization header; the relay answers with one line to show.
    auth = {"Value": {"string": "Bearer " + OBJ, "attachmentsByRange": {"{7, 1}": {"Type": "ActionOutput", "OutputName": "Text",
            "OutputUUID": code["WFWorkflowActionParameters"]["UUID"]}}}, "WFSerializationType": "WFTextTokenString"}
    post = with_uuid(act("downloadurl", WFURL="https://relay.sendtogrokbot.com/v1/send", WFHTTPMethod="POST", WFHTTPBodyType="JSON",
        ShowHeaders=True,
        WFHTTPHeaders={"Value": {"WFDictionaryFieldValueItems": [
            {"WFItemType": 0, "WFKey": plain("Authorization"), "WFValue": auth},
        ]}, "WFSerializationType": "WFDictionaryFieldValue"},
        WFJSONValues={"Value": {"WFDictionaryFieldValueItems": [
            {"WFItemType": 0, "WFKey": plain("destination"), "WFValue": plain("grokbot")},
            {"WFItemType": 0, "WFKey": plain("url"), "WFValue": shared_input()},
            {"WFItemType": 0, "WFKey": plain("format"), "WFValue": plain("text")},
        ]}, "WFSerializationType": "WFDictionaryFieldValue"}))
    return [post, act("notification", WFNotificationActionTitle=plain("Send to Grok Bot"),
                      WFNotificationActionBody=text_of(post, "Contents of URL"))]

def build():
    shared = with_uuid(act("detect.text", WFInput={"Value": {"Type": "ExtensionInput"}, "WFSerializationType": "WFTextTokenAttachment"}))
    is_setup, has_code, menu = gid(), gid(), gid()
    a = [shared, if_contains(shared, "Text", CODE_MARK, is_setup),
         # Run by the setup page's Finish button: keep the code for every later share.
         act("documentpicker.save", WFInput=output_of(shared, "Text"), WFAskWhereToSave=False,
             WFFileDestinationPath=CODE_FILE, WFSaveFileOverwrite=True),
         act("notification", WFNotificationActionTitle=plain("Connected to Grok Bot"),
             WFNotificationActionBody=plain("In X, tap Share on a post, then Share via, then Send to Grok Bot.")),
         act("conditional", GroupingIdentifier=is_setup, WFControlFlowMode=1)]
    saved = with_uuid(act("documentpicker.open", WFShowFilePicker=False, WFGetFilePath=CODE_FILE, WFFileErrorIfNotFound=False))
    code = with_uuid(act("detect.text", WFInput=output_of(saved, "File")))
    a += [saved, code, if_contains(code, "Text", CODE_MARK, has_code)]
    a += send_in_background(code)
    a.append(act("conditional", GroupingIdentifier=has_code, WFControlFlowMode=1))
    a.append(act("choosefrommenu", GroupingIdentifier=menu, WFControlFlowMode=0, WFMenuPrompt="Send this post to",
                 WFMenuItems=[t for t, _ in MENU]))
    for title, dest in MENU:
        a.append(act("choosefrommenu", GroupingIdentifier=menu, WFControlFlowMode=1, WFMenuItemTitle=title))
        a += send_steps(dest)
    a.append(act("choosefrommenu", GroupingIdentifier=menu, WFControlFlowMode=2))
    a.append(act("conditional", GroupingIdentifier=has_code, WFControlFlowMode=2))
    a.append(act("conditional", GroupingIdentifier=is_setup, WFControlFlowMode=2))
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
