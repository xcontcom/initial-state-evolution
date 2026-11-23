'use strict';
const {bitAt,geometry}=require('./ga_core');

const FINAL_STEP=512;
const SIGNATURE_WINDOW_START=256;
const SIGNATURE_WINDOW_END=512;
const HISTORY_BITS=8;
const COLLECT_START=SIGNATURE_WINDOW_START-HISTORY_BITS+1;
const cache=new Map();

function layout(size){
	if(cache.has(size))return cache.get(size);
	const g=geometry(size);
	const joinedWidth=size*2;
	const joinedCells=joinedWidth*size;
	const idx=Array.from({length:8},()=>new Uint32Array(joinedCells));
	for(let y=0;y<size;y++){
		const ym=(y+size-1)%size,yp=(y+1)%size;
		for(let x=0;x<joinedWidth;x++){
			const xm=(x+joinedWidth-1)%joinedWidth,xp=(x+1)%joinedWidth;
			const i=y*joinedWidth+x;
			idx[0][i]=ym*joinedWidth+xm;
			idx[1][i]=ym*joinedWidth+x;
			idx[2][i]=ym*joinedWidth+xp;
			idx[3][i]=y*joinedWidth+xm;
			idx[4][i]=y*joinedWidth+xp;
			idx[5][i]=yp*joinedWidth+xm;
			idx[6][i]=yp*joinedWidth+x;
			idx[7][i]=yp*joinedWidth+xp;
		}
	}
	const value={size,cells:g.cells,joinedWidth,joinedCells,neighbors:idx};
	cache.set(size,value);
	return value;
}
function assemble(a,b,size){
	const info=layout(size),joined=new Uint8Array(info.joinedCells);
	for(let y=0;y<size;y++){
		let k=y*size,p=y*info.joinedWidth;
		for(let x=0;x<size;x++,k++){
			joined[p+x]=bitAt(a,k);
			joined[p+size+x]=bitAt(b,k);
		}
	}
	return joined;
}
function advance(field,next,activeRule,info){
	const [N0,N1,N2,N3,N4,N5,N6,N7]=info.neighbors;
	for(let i=0;i<info.joinedCells;i++){
		const n=field[N0[i]]+field[N1[i]]+field[N2[i]]+field[N3[i]]+
			field[N4[i]]+field[N5[i]]+field[N6[i]]+field[N7[i]];
		next[i]=(activeRule>>>(n+(field[i]?9:0)))&1;
	}
}
function simulateFlickering(a,b,ruleA,ruleB,size){
	const info=layout(size);
	let field=assemble(a,b,size);
	let next=new Uint8Array(info.joinedCells);
	for(let step=1;step<=FINAL_STEP;step++){
		advance(field,next,(step&1)?ruleA:ruleB,info);
		if(step===FINAL_STEP){
			let flickA=0,flickB=0;
			for(let y=0;y<size;y++){
				const begin=y*info.joinedWidth;
				for(let x=0;x<size;x++){
					const i=begin+x;
					if(next[i]!==field[i])flickA++;
					if(next[i+size]!==field[i+size])flickB++;
				}
			}
			return {A:{flickering:flickA},B:{flickering:flickB}};
		}
		const tmp=field;field=next;next=tmp;
	}
}
function simulateRecovery(a,b,ruleA,ruleB,size){
	const info=layout(size);
	let field=assemble(a,b,size);
	let next=new Uint8Array(info.joinedCells);
	const codes=new Uint8Array(info.joinedCells);
	const histA=new Uint32Array(256),histB=new Uint32Array(256);
	histA[0]=info.cells;histB[0]=info.cells;
	const used=[1,1],minimum=[255,255],maximum=[0,0];
	const [N0,N1,N2,N3,N4,N5,N6,N7]=info.neighbors;
	for(let step=1;step<=FINAL_STEP;step++){
		const activeRule=(step&1)?ruleA:ruleB;
		if(step<COLLECT_START){
			advance(field,next,activeRule,info);
		}else{
			for(let y=0;y<size;y++){
				const begin=y*info.joinedWidth;
				for(let x=0;x<info.joinedWidth;x++){
					const i=begin+x;
					const n=field[N0[i]]+field[N1[i]]+field[N2[i]]+field[N3[i]]+
						field[N4[i]]+field[N5[i]]+field[N6[i]]+field[N7[i]];
					const value=(activeRule>>>(n+(field[i]?9:0)))&1;
					next[i]=value;
					const prev=codes[i];
					const curr=((prev<<1)&255)|value;
					if(prev!==curr){
						const side=x<size?0:1;
						const hist=side===0?histA:histB;
						if(--hist[prev]===0)used[side]--;
						if(hist[curr]++===0)used[side]++;
						codes[i]=curr;
					}
				}
			}
			if(step>=SIGNATURE_WINDOW_START){
				for(let side=0;side<2;side++){
					const v=used[side]-1;
					if(v<minimum[side])minimum[side]=v;
					const climb=v-minimum[side];
					if(climb>maximum[side])maximum[side]=climb;
				}
			}
		}
		const tmp=field;field=next;next=tmp;
	}
	return {A:{max_recovery:maximum[0]},B:{max_recovery:maximum[1]}};
}
function simulate(a,b,ruleA,ruleB,score='max_recovery',size=89){
	if(score==='flickering')return simulateFlickering(a,b,ruleA,ruleB,size);
	if(score==='max_recovery')return simulateRecovery(a,b,ruleA,ruleB,size);
	throw Error('Unknown simulation score: '+score);
}

module.exports={FINAL_STEP,SIGNATURE_WINDOW_START,SIGNATURE_WINDOW_END,HISTORY_BITS,assemble,simulate,layout};
