const express=require('express'),http=require('http'),os=require('os'),path=require('path'),QRCode=require('qrcode');
const {Server}=require('socket.io');
const {rooms,createRoom,joinRoom,leaveRoom,publicPlayers}=require('./rooms');
const app=express(),server=http.createServer(app),io=new Server(server,{cors:{origin:'*'}}),PORT=Number(process.env.PORT)||3000;
app.disable('x-powered-by');app.use(express.static(path.join(__dirname,'../public')));app.get('/health',(_,res)=>res.json({ok:true,rooms:rooms.size}));
function ip(){for(const list of Object.values(os.networkInterfaces()))for(const x of list||[])if(x.family==='IPv4'&&!x.internal)return x.address;return'localhost'}
function state(r){return{roomId:r.id,gameId:r.gameId,status:r.status,players:publicPlayers(r)}}
function emit(r){io.to(r.id).emit('room_state',state(r))}
io.on('connection',s=>{
 s.on('host_create_room',async()=>{const r=createRoom(s.id);s.join(r.id);const base=`http://${ip()}:${PORT}`,url=`${base}/controller.html?room=${r.id}`,qr=await QRCode.toDataURL(url,{width:320,margin:1,errorCorrectionLevel:'M'});s.emit('room_created',{roomId:r.id,joinUrl:url,qrDataUrl:qr});emit(r)});
 s.on('host_set_game',({roomId,gameId})=>{const r=rooms.get(String(roomId||'').trim().toUpperCase());if(!r||r.hostId!==s.id)return;r.gameId=String(gameId||'');emit(r)});
 s.on('host_set_status',({roomId,status})=>{const r=rooms.get(String(roomId||'').trim().toUpperCase());if(!r||r.hostId!==s.id||!['lobby','running','finished'].includes(status))return;r.status=status;emit(r)});
 s.on('host_update_scores',({roomId,scores})=>{const r=rooms.get(String(roomId||'').trim().toUpperCase());if(!r||r.hostId!==s.id||!Array.isArray(scores))return;const m=new Map(scores.map(x=>[String(x.id),Number(x.score)||0]));for(const p of r.players.values())if(m.has(p.id))p.score=Math.max(0,Math.round(m.get(p.id)));io.to(r.id).emit('score_update',{players:publicPlayers(r)})});
 s.on('player_join_room',({roomId,playerName})=>{const id=String(roomId||'').trim().toUpperCase(),res=joinRoom(id,s.id,playerName);if(res.error)return s.emit('join_error',res.error);s.join(id);s.data.roomId=id;s.emit('join_success',{roomId:id,player:res.player,gameId:res.room.gameId});emit(res.room)});
 s.on('controller_input',({roomId,action})=>{const r=rooms.get(String(roomId||'').trim().toUpperCase());if(!r||!r.players.has(s.id)||typeof action!=='string')return;io.to(r.hostId).emit('player_action',{playerId:s.id,action})});
 s.on('disconnect',()=>{const x=leaveRoom(s.id);if(!x)return;if(x.type==='HOST_LEFT')return io.to(x.roomId).emit('session_closed');io.to(x.hostId).emit('player_left',{playerId:x.player.id,allPlayers:publicPlayers(x.room)});emit(x.room)})
});
server.listen(PORT,'0.0.0.0',()=>console.log(`\n🎮 PlaySync: http://localhost:${PORT}\n📱 LAN: http://${ip()}:${PORT}\n`));
