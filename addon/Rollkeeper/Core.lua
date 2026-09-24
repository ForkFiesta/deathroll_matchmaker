-- Pure Lua 5.1 core. No network access, automated actions, or payment functions.
RollkeeperCore = {}
local Core = RollkeeperCore

local function split(value)
    local result = {}
    for part in (value .. "|"):gmatch("(.-)|") do result[#result + 1] = part end
    return result
end

local function decodeHex(value)
    if #value == 0 or #value > 320 or #value % 2 ~= 0 or value:find("[^0-9a-f]") then return nil end
    local decoded = value:gsub("..", function(pair) return string.char(tonumber(pair, 16)) end)
    if decoded:find("[%z\1-\31\127]") then return nil end
    return decoded
end

local function integer(value, low, high)
    if not value:match("^%d+$") then return nil end
    local number = tonumber(value)
    if not number or number < low or number > high then return nil end
    return number
end

function Core.ParseTicket(value)
    if type(value) ~= "string" or #value > 1400 then return nil, "Ticket is too long." end
    value = value:match("^%s*(.-)%s*$")
    local fields = split(value)
    if #fields ~= 13 or fields[1] ~= "RK1" or fields[3] ~= "practice" then return nil, "Use a complete RK1 practice ticket." end
    if #fields[2] ~= 36 or not fields[2]:match("^[a-f0-9%-]+$") then return nil, "Invalid match ID." end
    if fields[4] ~= "US" and fields[4] ~= "EU" then return nil, "Unknown region." end
    if fields[5] ~= "Normal" and fields[5] ~= "PvP" and fields[5] ~= "Hardcore" then return nil, "Unknown ruleset." end
    if fields[6] ~= "Alliance" and fields[6] ~= "Horde" then return nil, "Unknown faction." end
    local stake = integer(fields[7], 1, 1000)
    local start = integer(fields[8], 2, 1000000)
    local first = integer(fields[9], 1, 2)
    local player1, player2, zone = decodeHex(fields[10]), decodeHex(fields[11]), decodeHex(fields[12])
    local createdAt = integer(fields[13], 1, 9999999999)
    if not stake or not start or not first or not player1 or not player2 or not zone or not createdAt then return nil, "Invalid ticket terms." end
    if player1 == player2 then return nil, "Players must have different names." end
    return { id = fields[2], mode = "practice", region = fields[4], ruleset = fields[5], faction = fields[6],
        stake = stake, start = start, turn = first, first = first, players = { player1, player2 }, zone = zone,
        createdAt = createdAt, maximum = start, rolls = {}, loser = nil }
end

function Core.Observe(match, name, value, low, high)
    if not match then return false, "Import a ticket first." end
    if match.loser then return false, "This practice game is already finished." end
    if name ~= match.players[match.turn] then return false, "Unexpected player; roll ignored." end
    if low ~= 1 or high ~= match.maximum or type(value) ~= "number" or value ~= math.floor(value) or value < 1 or value > high then
        return false, "Incorrect range or value; roll ignored."
    end
    match.rolls[#match.rolls + 1] = { player = match.turn, value = value, low = low, high = high }
    match.maximum = value
    if value == 1 then match.loser = match.turn else match.turn = match.turn == 1 and 2 or 1 end
    return true
end

-- Build the parser from the client's localized format, including positional %1$s / %2$d placeholders.
function Core.RollParser(format)
    if type(format) ~= "string" then return nil end
    local pattern, order, offset, sequential = "^", {}, 1, 0
    while offset <= #format do
        local rest = format:sub(offset)
        local token, position, kind = rest:match("^(%%(%d+)%$([sd]))")
        if not token then
            token, kind = rest:match("^(%%([sd]))")
            if token then sequential = sequential + 1; position = sequential end
        end
        if token then
            order[#order + 1] = tonumber(position)
            pattern = pattern .. (kind == "s" and "(.+)" or "(%d+)")
            offset = offset + #token
        else
            local character = format:sub(offset, offset)
            if character:find("[%(%)%.%%%+%-%*%?%[%]%^%$]") then character = "%" .. character end
            pattern = pattern .. character
            offset = offset + 1
        end
    end
    if #order ~= 4 then return nil end
    pattern = pattern .. "$"
    return function(message)
        if type(message) ~= "string" then return nil end
        local captures = { message:match(pattern) }
        if #captures ~= 4 then return nil end
        local values = {}
        for index, position in ipairs(order) do values[position] = captures[index] end
        return values[1], tonumber(values[2]), tonumber(values[3]), tonumber(values[4])
    end
end

function Core.Receipt(match, now)
    if not match or not match.loser then return nil, "Finish the observed game before exporting a receipt." end
    return table.concat({ "RKR1", match.id, "practice", "player" .. match.loser, tostring(math.floor(now)) }, "|")
end
