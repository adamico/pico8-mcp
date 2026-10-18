pico-8 cartridge // http://www.pico-8.com
version 42
__lua__
-- exercises #include resolution relative to this cart
#include lib.lua
#include tabs.p8:1
n=0
function _update() n+=1 end
function _draw() cls(lib_col) end
__gfx__
