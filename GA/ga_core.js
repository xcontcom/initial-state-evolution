'use strict';
const {randomUint32,integer}=require('./rng');

function geometry(size){
	if(!Number.isInteger(size)||size<1)throw Error('Bad field size');
	const cells=size*size;
	const bytes=Math.ceil(cells/8);
	const tailBits=cells&7;
	return {size,cells,bytes,lastMask:tailBits?((1<<tailBits)-1):255};
}
function randomField(rng,size,density=0.5){
	const g=geometry(size),b=new Uint8Array(g.bytes);
	if(density===0.5){
		for(let i=0;i<g.bytes;i++)b[i]=randomUint32(rng)&255;
	}else if(density<=0){
		// already zero
	}else if(density>=1){
		b.fill(255);
	}else{
		for(let i=0;i<g.cells;i++)if((randomUint32(rng)>>>0)/4294967296<density)b[i>>>3]|=1<<(i&7);
	}
	if((g.cells&7)!==0)b[g.bytes-1]&=g.lastMask;
	return b;
}
function initializePopulation(count,rng,size,density){
	return Array.from({length:count},()=>({field:randomField(rng,size,density),best:null}));
}
function bitAt(bytes,i){return (bytes[i>>>3]>>>(i&7))&1;}
function flipBit(bytes,i){bytes[i>>>3]^=1<<(i&7);}
function packFieldToBase64(bytes){return Buffer.from(bytes).toString('base64');}
function unpackFieldFromBase64(s,size){
	const g=geometry(size);
	if(typeof s!=='string'||!/^([A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))throw Error('Invalid base64 field');
	const b=Buffer.from(s,'base64');
	if(b.length!==g.bytes||((g.cells&7)!==0&&(b[g.bytes-1]&~g.lastMask)!==0))throw Error('Wrong field byte count / extra set bits');
	return Uint8Array.from(b);
}
function serializePopulation(pop){return pop.map(p=>[packFieldToBase64(p.field),p.best]);}
function deserializePopulation(rows,n,size){
	if(!Array.isArray(rows)||rows.length!==n)throw Error('Invalid saved population size');
	return rows.map(row=>{
		if(!Array.isArray(row)||row.length!==2||(row[1]!==null&&!Number.isFinite(row[1])))throw Error('Invalid saved individual');
		return {field:unpackFieldFromBase64(row[0],size),best:row[1]};
	});
}
function shuffle(items,rng){
	for(let i=items.length-1;i>0;i--){
		const j=integer(rng,i+1);
		[items[i],items[j]]=[items[j],items[i]];
	}
	return items;
}
function mutate(bytes,flips,rng,size){
	const g=geometry(size),used=new Set();
	while(used.size<flips){
		const i=integer(rng,g.cells);
		if(used.has(i))continue;
		used.add(i);
		flipBit(bytes,i);
	}
}
function evolveOnePopulation(population,rng,minFlips,maxFlips,size,useStoredFitness){
	const g=geometry(size),n=population.length;
	if(n<4||n%4!==0)throw Error('Population size must be divisible by 4');
	if(population.some(p=>p.best===null))throw Error('Cannot select unevaluated individuals');
	const parents=population.slice().sort((a,b)=>b.best-a.best).slice(0,n/2);
	const next=parents.map(p=>({field:p.field,best:useStoredFitness?p.best:null}));
	const mates=shuffle(parents.slice(),rng);
	for(let i=0;i<mates.length;i+=2){
		const a=mates[i].field,b=mates[i+1].field;
		const childA=new Uint8Array(g.bytes),childB=new Uint8Array(g.bytes);
		for(let j=0;j<g.bytes;j++){
			const mask=randomUint32(rng)&255;
			childA[j]=(a[j]&mask)|(b[j]&~mask);
			childB[j]=(b[j]&mask)|(a[j]&~mask);
		}
		if((g.cells&7)!==0){childA[g.bytes-1]&=g.lastMask;childB[g.bytes-1]&=g.lastMask;}
		const kA=minFlips+integer(rng,maxFlips-minFlips+1);
		const kB=minFlips+integer(rng,maxFlips-minFlips+1);
		mutate(childA,kA,rng,size);
		mutate(childB,kB,rng,size);
		next.push({field:childA,best:null},{field:childB,best:null});
	}
	if(next.length!==n)throw Error('Wrong next-population size');
	return next;
}
function populationDensity(bytes,size){
	const g=geometry(size);let count=0;
	for(let i=0;i<g.cells;i++)count+=bitAt(bytes,i);
	return count;
}
module.exports={geometry,randomField,initializePopulation,bitAt,
	packFieldToBase64,unpackFieldFromBase64,serializePopulation,deserializePopulation,
	shuffle,evolveOnePopulation,populationDensity};
