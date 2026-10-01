import * as THREE from 'three';
export const EYE_HEIGHT=1.6;
export const RUN_ACCEL=42,AIR_ACCEL=21,WALL_RUN_MIN_SPEED=3,WALL_EDGE_POP=10,JUMP_SPEED=17,WALL_KICK={out:9,up:15};
export function pickAnchor(position,direction,anchors){
 let best=null,bestScore=-Infinity;
 for(const anchor of anchors){const delta=anchor.clone().sub(position),distance=delta.length();if(distance<14||distance>95||anchor.y<position.y-3)continue;const alignment=delta.normalize().dot(direction);if(alignment<.08)continue;const score=alignment*70-distance*.22+Math.min(anchor.y-position.y,30)*.25;if(score>bestScore){best=anchor;bestScore=score}}
 return best;
}
export function stepSwing(state,input,dt,buildings){
 const p=state.position,v=state.velocity,previous=p.clone();const onGround=state.grounded,hadWall=state.wall;state.grounded=false;state.wall=null;
 const desired=new THREE.Vector3(-Math.sin(input.yaw)*input.forward+Math.cos(input.yaw)*input.side,0,-Math.cos(input.yaw)*input.forward-Math.sin(input.yaw)*input.side);
 if(desired.lengthSq()>1)desired.normalize();v.addScaledVector(desired,dt*(onGround?RUN_ACCEL:AIR_ACCEL));v.y-=19*dt;
 if(state.anchor){const d=state.anchor.clone().sub(p),distance=d.length();state.ropeLength=Math.max(8,state.ropeLength-dt*5);if(distance>state.ropeLength){d.normalize();v.addScaledVector(d,Math.min(100,(distance-state.ropeLength)*13)*dt)}}
 v.multiplyScalar(Math.exp(-dt*.10));if(v.length()>55)v.setLength(55);p.addScaledVector(v,dt);
 // Each frame is subdivided to keep collision displacement below the player radius.
 const radius=.42;
 for(const b of buildings){
  if(p.x<b.minX-radius||p.x>b.maxX+radius||p.z<b.minZ-radius||p.z>b.maxZ+radius||p.y-EYE_HEIGHT>b.height)continue;
  if(previous.y-EYE_HEIGHT>=b.height-.04&&v.y<=0){p.y=b.height+EYE_HEIGHT;v.y=0;state.grounded=true;continue}
  const faces=[{d:Math.abs(p.x-(b.minX-radius)),axis:'x',value:b.minX-radius,dir:-1},{d:Math.abs(p.x-(b.maxX+radius)),axis:'x',value:b.maxX+radius,dir:1},{d:Math.abs(p.z-(b.minZ-radius)),axis:'z',value:b.minZ-radius,dir:-1},{d:Math.abs(p.z-(b.maxZ+radius)),axis:'z',value:b.maxZ+radius,dir:1}];faces.sort((a,b)=>a.d-b.d);
  const face=faces[0];p[face.axis]=face.value;v[face.axis]=0;
  // Wall run: any airborne slide along a face, with no web out, holds you on the wall with
  // gravity off — you never drop while moving along a wall. Space (the caller) kicks off.
  const along=face.axis==='x'?v.z:v.x;
  if(!state.anchor&&Math.abs(along)>WALL_RUN_MIN_SPEED){state.wall={axis:face.axis,dir:face.dir};v.y+=19*dt;if(v.y<0.5){v.y=0;p.y=Math.max(p.y,previous.y)}}
 }
 // Running off the top of a wall pops you up over the edge.
 if(hadWall&&!state.wall&&!state.grounded)v.y=Math.max(v.y,WALL_EDGE_POP);
 if(p.y<EYE_HEIGHT){p.y=EYE_HEIGHT;v.y=0;state.grounded=true}
 if(state.grounded){v.x*=Math.exp(-dt*5);v.z*=Math.exp(-dt*5)}
}
export function segmentNearPoint(a,b,point,radius){const d=b.clone().sub(a),length=d.lengthSq(),t=length?THREE.MathUtils.clamp(point.clone().sub(a).dot(d)/length,0,1):0;return a.clone().addScaledVector(d,t).distanceTo(point)<=radius}
