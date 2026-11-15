export const GAMES=[
{id:'slip-n-bump',title:'Slip N Bump',subtitle:'ICE KNOCKOUT',icon:'❄️',accent:'#00f2ff',minPlayers:2,maxPlayers:8,description:'Arcade physics, dashes and power-ups on a floating ice arena.',module:'../games/slip-n-bump.js'},
{id:'cyber-tank',title:'Cyber Tank Duel',subtitle:'TACTICAL ARENA',icon:'🛡️',accent:'#ff4757',minPlayers:2,maxPlayers:8,description:'Fast top-down tank combat with free-aim movement, ricochet shots and boosts.',module:'../games/cyber-tank.js'}];
export const getGame=id=>GAMES.find(x=>x.id===id)||GAMES[0];
