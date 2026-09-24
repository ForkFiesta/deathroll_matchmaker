import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import luaparse from 'luaparse';
const require = createRequire(import.meta.url);
const { lua, lauxlib, lualib, to_luastring, to_jsstring } = require('fengari');

test('addon source is valid Lua 5.1', () => {
  for (const file of ['Core.lua', 'Rollkeeper.lua'])
    assert.doesNotThrow(() =>
      luaparse.parse(readFileSync(`addon/Rollkeeper/${file}`, 'utf8'), { luaVersion: '5.1' }),
    );
});
test('addon validates tickets, localized roll order, outcomes, and receipt export', () => {
  const state = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(state);
  const source =
    readFileSync('addon/Rollkeeper/Core.lua', 'utf8') +
    '\n' +
    readFileSync('tests/addon.test.lua', 'utf8');
  const result = lauxlib.luaL_dostring(state, to_luastring(source));
  if (result !== lua.LUA_OK) assert.fail(to_jsstring(lua.lua_tostring(state, -1)));
  lua.lua_close(state);
});
