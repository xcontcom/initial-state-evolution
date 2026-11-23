'use strict';

function createPreview(size){
	const side=size;
	const width=side*2;
	const height=side;
	const cells=width*height;
	const neighbors=Array.from({length:8},()=>new Uint32Array(cells));
	for(let y=0;y<height;y++){
		const above=(y+height-1)%height;
		const below=(y+1)%height;
		for(let x=0;x<width;x++){
			const left=(x+width-1)%width;
			const right=(x+1)%width;
			const i=y*width+x;
			neighbors[0][i]=above*width+left;
			neighbors[1][i]=above*width+x;
			neighbors[2][i]=above*width+right;
			neighbors[3][i]=y*width+left;
			neighbors[4][i]=y*width+right;
			neighbors[5][i]=below*width+left;
			neighbors[6][i]=below*width+x;
			neighbors[7][i]=below*width+right;
		}
	}
	const [P0,P1,P2,P3,P4,P5,P6,P7]=neighbors;
	function packedBit(bytes,i){return (bytes[i>>>3]>>>(i&7))&1;}
	function assemble(a,b){
		const field=new Uint8Array(cells);
		for(let y=0;y<height;y++){
			const halfRow=y*side;
			const fullRow=y*width;
			for(let x=0;x<side;x++){
				field[fullRow+x]=packedBit(a,halfRow+x);
				field[fullRow+side+x]=packedBit(b,halfRow+x);
			}
		}
		return field;
	}
	function advance(field,next,rule){
		for(let i=0;i<cells;i++){
			const n=field[P0[i]]+field[P1[i]]+field[P2[i]]+field[P3[i]]+
				field[P4[i]]+field[P5[i]]+field[P6[i]]+field[P7[i]];
			next[i]=(rule>>>(n+(field[i]?9:0)))&1;
		}
	}
	return {WIDTH:width,HEIGHT:height,CELLS:cells,assemble,advance};
}

const PREVIEW_CA_API={create:createPreview};
if(typeof module!=='undefined'&&module.exports)module.exports=PREVIEW_CA_API;
else window.InitialCAPreview=PREVIEW_CA_API;
