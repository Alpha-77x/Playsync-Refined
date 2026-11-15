const MAX_PLAYERS=8;
const PLAYER_COLORS=['#ff4757','#2ed573','#1e90ff','#ffa502','#9b59b6','#00d2d3','#ff6b81','#a4b0be'];
const rooms=new Map();
function code(){const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from({length:4},()=>c[Math.floor(Math.random()*c.length)]).join('')}
function createRoom(hostId){let id;do{id=code()}while(rooms.has(id));const r={id,hostId,gameId:null,status:'lobby',players:new Map()};rooms.set(id,r);return r}
function joinRoom(id,socketId,name){const r=rooms.get(id);if(!r)return{error:'Room code not found.'};if(r.players.size>=MAX_PLAYERS)return{error:'Room is full (8 players max).'};let slot=1;while([...r.players.values()].some(p=>p.slot===slot))slot++;const p={id:socketId,name:String(name||'').trim().slice(0,12)||`Player ${slot}`,slot,color:PLAYER_COLORS[slot-1],score:0};r.players.set(socketId,p);return{room:r,player:p}}
function leaveRoom(socketId){for(const [id,r] of rooms){if(r.hostId===socketId){rooms.delete(id);return{type:'HOST_LEFT',roomId:id}}if(r.players.has(socketId)){const p=r.players.get(socketId);r.players.delete(socketId);return{type:'PLAYER_LEFT',roomId:id,hostId:r.hostId,player:p,room:r}}}return null}
function publicPlayers(r){return [...r.players.values()].map(({id,name,slot,color,score})=>({id,name,slot,color,score}))}
module.exports={MAX_PLAYERS,rooms,createRoom,joinRoom,leaveRoom,publicPlayers};
