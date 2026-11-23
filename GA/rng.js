'use strict';
// Deterministic xorshift32, matching the provided GA's RNG. No OOP required.
function newRng(seed){
	if(!Number.isInteger(seed))throw Error('Bad seed');
	return {state:(seed>>>0)||0x6d2b79f5};
}
function randomUint32(rng){
	let x=rng.state;
	x^=x<<13; x^=x>>>17; x^=x<<5;
	rng.state=x>>>0;
	return rng.state;
}
function random(rng){return randomUint32(rng)/4294967296;}
function integer(rng,max){return Math.floor(random(rng)*max);}
function seedForRun(baseSeed,index){
	if(!Number.isInteger(baseSeed)||baseSeed<0||baseSeed>0xffffffff)throw Error('Invalid base seed');
	let x=(baseSeed^Math.imul(index+1,0x9e3779b9))>>>0;
	x^=x>>>16;x=Math.imul(x,0x7feb352d);
	x^=x>>>15;x=Math.imul(x,0x846ca68b);
	x^=x>>>16;
	return x>>>0||0x6d2b79f5;
}
module.exports={newRng,randomUint32,random,integer,seedForRun};
