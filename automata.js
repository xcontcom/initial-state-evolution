var k;
var a=[];
var b=[];
var rulesize=512;
var rule=[];
var sizex=256;
var sizey=256;
var size=2;
var r=[
	0,0,0,1,0,0,0,0,0,
	0,0,1,1,0,0,0,0,0
];

function nexta(newa=true){
	
	if(newa) for(var i=0;i<18;i++) r[i]=Math.round(Math.random());
	
    for (let i = 0; i < 512; i++) {
        let q = ((i >> 4) & 1) * 8;
        for (let j = 0; j < 9; j++) {
            q += (i >> j) & 1;
        }
        rule[i] = r[q];
    }
	clearpage();
}


function clearpage(){
	k=0;
	var hello=document.getElementById('console-log0');
	hello.innerHTML=k;
	var canvas, context, rand;
	canvas=document.getElementById('myCanvas');
	context=canvas.getContext('2d');
	canvas.width=sizex*size, canvas.height=sizey*size;
	context.fillStyle = 'rgb(0,0,0)';
	context.fillRect (0, 0, sizex*size, sizey*size);
	context.fillStyle = 'rgb(255,255,255)';
	

	for(var x=0;x<sizex;x++){
		b[x]=[]
		for(var y=0;y<sizey;y++){
			b[x][y]=Math.round(Math.random());
			if(b[x][y]) context.fillRect(x*size, y*size, 1*size, 1*size);
		}
	}
}

function test(){
	countpoints();
}


function init(){
	nexta(false);
}

var timerId;
function start(){
	if(!timerId){
		timerId = setInterval(function() {
			countpoints();
		}, 1);
	}
	
};
function stop(){
	if(timerId){
		clearInterval(timerId);
		timerId=false;
	}
};
function countpoints(){
	k++;
	var temp=new Array(sizex);
	var canvas, context;
	

	canvas=document.getElementById('myCanvas');
	context=canvas.getContext('2d');
	canvas.width=sizex*size, canvas.height=sizey*size;
	context.fillStyle = 'rgb(0,0,0)';
	context.fillRect (0, 0, sizex*size, sizey*size);
	context.fillStyle = 'rgb(255,255,255)';

	for (var x = 0; x < sizex; x++) {
		temp[x] = new Array(sizey);
		const xm = (x - 1 + sizex) % sizex;
		const xp = (x + 1) % sizex;

		for (var y = 0; y < sizey; y++) {
			const ym = (y - 1 + sizey) % sizey;
			const yp = (y + 1) % sizey;

			let q = (
				(b[xm][ym] << 8) |
				(b[x][ym] << 7) |
				(b[xp][ym] << 6) |
				(b[xm][y] << 5) |
				(b[x][y] << 4) |
				(b[xp][y] << 3) |
				(b[xm][yp] << 2) |
				(b[x][yp] << 1) |
				b[xp][yp]
			);

			temp[x][y] = rule[q];
			if (temp[x][y]) {
				context.fillRect(x * size, y * size, size, size);
			}
		}
	}
	
	b=temp;
	
	var hello=document.getElementById('console-log0');
	hello.innerHTML=k;
	var hello1=document.getElementById('console-log1');
	hello1.innerHTML=r.join('');

}