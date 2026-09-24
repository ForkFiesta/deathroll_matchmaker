local Core = RollkeeperCore
local frame, statusText, detailText, importBox, exportBox, parser
local events = CreateFrame("Frame")
events:RegisterEvent("ADDON_LOADED")
events:RegisterEvent("CHAT_MSG_SYSTEM")

local function setStatus(text) if statusText then statusText:SetText(text) end end
local function refresh()
    if not detailText then return end
    local match = RollkeeperDB and RollkeeperDB.match
    if not match then
        detailText:SetText("Import a practice ticket to begin.\nNo real gold is owed or transferred.")
        return
    end
    local nextAction = match.loser and (match.players[match.loser] .. " rolled 1. Practice game complete.")
        or ("Next: " .. match.players[match.turn] .. "\nType /roll " .. match.maximum .. " yourself.")
    detailText:SetText(match.players[1] .. " vs. " .. match.players[2] .. "\n" .. match.stake .. "g PRACTICE | " .. match.zone .. "\n" .. nextAction)
end

local function makeButton(parent, text, x, y, callback)
    local button = CreateFrame("Button", nil, parent, "UIPanelButtonTemplate")
    button:SetSize(150, 27); button:SetPoint("TOPLEFT", x, y); button:SetText(text); button:SetScript("OnClick", callback)
    return button
end

local function buildWindow()
    frame = CreateFrame("Frame", "RollkeeperWindow", UIParent, "BackdropTemplate")
    frame:SetSize(510, 415); frame:SetPoint("CENTER"); frame:SetFrameStrata("DIALOG")
    frame:SetBackdrop({ bgFile = "Interface\\DialogFrame\\UI-DialogBox-Background", edgeFile = "Interface\\Tooltips\\UI-Tooltip-Border", tile = true, tileSize = 16, edgeSize = 16, insets = { left = 4, right = 4, top = 4, bottom = 4 } })
    frame:SetBackdropColor(0.06, 0.10, 0.08, 1)
    frame:EnableMouse(true); frame:SetMovable(true); frame:RegisterForDrag("LeftButton")
    frame:SetScript("OnDragStart", frame.StartMoving); frame:SetScript("OnDragStop", frame.StopMovingOrSizing)
    local close = CreateFrame("Button", nil, frame, "UIPanelCloseButton"); close:SetPoint("TOPRIGHT", -5, -5)
    local title = frame:CreateFontString(nil, "OVERLAY", "GameFontNormalLarge"); title:SetPoint("TOPLEFT", 22, -21); title:SetText("Rollkeeper | Practice")
    local caption = frame:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall"); caption:SetPoint("TOPLEFT", 22, -52); caption:SetText("Paste the full RK1 ticket. Imported terms are unverified.")
    importBox = CreateFrame("EditBox", nil, frame, "InputBoxTemplate"); importBox:SetSize(460, 28); importBox:SetPoint("TOPLEFT", 27, -76)
    importBox:SetAutoFocus(false); importBox:SetMaxLetters(1400); importBox:SetScript("OnEscapePressed", importBox.ClearFocus)
    makeButton(frame, "Import practice terms", 22, -114, function()
        local match, err = Core.ParseTicket(importBox:GetText())
        if not match then setStatus(err); return end
        if RollkeeperDB.match and not RollkeeperDB.match.loser then setStatus("A game is already active. Type /rk reset to clear it first."); return end
        RollkeeperDB.match = match; importBox:ClearFocus(); exportBox:SetText("")
        setStatus("Terms imported. Both players must agree before rolling."); refresh()
    end)
    detailText = frame:CreateFontString(nil, "OVERLAY", "GameFontHighlight"); detailText:SetPoint("TOPLEFT", 22, -160); detailText:SetSize(466, 90); detailText:SetJustifyH("LEFT"); detailText:SetJustifyV("TOP")
    makeButton(frame, "Create practice receipt", 22, -260, function()
        local receipt, err = Core.Receipt(RollkeeperDB.match, time())
        if not receipt then setStatus(err); return end
        exportBox:SetText(receipt); exportBox:SetFocus(); exportBox:HighlightText()
        setStatus("Copy manually. This is client-supplied evidence, not proof of payment.")
    end)
    exportBox = CreateFrame("EditBox", nil, frame, "InputBoxTemplate"); exportBox:SetSize(460, 28); exportBox:SetPoint("TOPLEFT", 27, -299); exportBox:SetAutoFocus(false)
    exportBox:SetScript("OnEscapePressed", exportBox.ClearFocus)
    statusText = frame:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall"); statusText:SetPoint("TOPLEFT", 22, -340); statusText:SetSize(466, 50); statusText:SetJustifyH("LEFT"); statusText:SetJustifyV("TOP")
    table.insert(UISpecialFrames, "RollkeeperWindow")
    refresh(); frame:Hide()
end

events:SetScript("OnEvent", function(_, event, ...)
    if event == "ADDON_LOADED" then
        local name = ...
        if name ~= "Rollkeeper" then return end
        RollkeeperDB = type(RollkeeperDB) == "table" and RollkeeperDB or {}
        -- Only load the known version of saved state; /rk reset clears an interrupted game.
        if RollkeeperDB.version ~= 1 then RollkeeperDB = { version = 1 } end
        parser = Core.RollParser(RANDOM_ROLL_RESULT)
        buildWindow()
        if not parser then setStatus("This client's roll format is unsupported. No results will be recorded.") end
        events:UnregisterEvent("ADDON_LOADED")
    elseif event == "CHAT_MSG_SYSTEM" and parser and RollkeeperDB and RollkeeperDB.match then
        local message = ...
        local name, value, low, high = parser(message)
        if not name then return end
        local match = RollkeeperDB.match
        if name ~= match.players[1] and name ~= match.players[2] then return end
        local ok, err = Core.Observe(match, name, value, low, high)
        if not ok then setStatus(err) else setStatus("Observed a system roll. This record remains client-supplied."); refresh() end
    end
end)

SLASH_ROLLKEEPER1 = "/rollkeeper"
SLASH_ROLLKEEPER2 = "/rk"
SlashCmdList.ROLLKEEPER = function(message)
    if not frame then return end
    if message == "reset" then
        RollkeeperDB.match = nil; exportBox:SetText(""); setStatus("Local practice record cleared."); refresh()
    end
    frame:Show()
end
