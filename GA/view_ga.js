'use strict';
const $=id=>document.getElementById(id);
const FIG_W=512,FIG_H=512,MARGIN_LEFT=62,MARGIN_TOP=12;
const GRAPH_W=591,GRAPH_H=576;
let DATA=null,ACTIVE=null,RUNS=[],topShown=[],selectedPairKey=null,loadingToken=0;
const experimentProgress=new Map();
let resultsScriptQueue=Promise.resolve();
// One persistent animation timer. Loading another top pair must NOT stop it.
let previewField=null,previewNext=null,previewRuleA=0,previewRuleB=0,previewApi=null;
let previewStep=0,previewTimer=null,previewPixels=null;
const metricLabels={stored:'Stored best fitness',current:'Current fitness',
	recovery:'Maximum recovery',flickering:'Flickering'};
function format(v){return Number.isInteger(v)?String(v):Number(v).toFixed(2);}
function setStatus(s,bad=false){$('status').textContent=s;$('status').className=bad?'error':'';}
function chooseTab(name){
	for(const b of document.querySelectorAll('.tab'))b.classList.toggle('active',b.dataset.tab===name);
	for(const name2 of ['evolution','tops'])$('tab_'+name2).hidden=name!==name2;
	if(DATA){if(name==='tops')drawTopPairs();else drawGraphs();}
}
function loadScript(url){
	return new Promise((resolve,reject)=>{
		const script=document.createElement('script');
		script.src=url+'?cache='+Date.now();
		script.onload=()=>{script.remove();resolve();};
		script.onerror=()=>{script.remove();reject(Error('Cannot load '+url));};
		document.head.appendChild(script);
	});
}
// All results.js files assign the same global. Serialize loads so that
// scanning experiment progress cannot interfere with the selected viewer.
function readResultsScript(url){
	const task=resultsScriptQueue.then(async()=>{
		window.InitialFieldGAPayload=null;
		try{
			await loadScript(url);
			return window.InitialFieldGAPayload;
		}finally{
			window.InitialFieldGAPayload=null;
		}
	});
	resultsScriptQueue=task.then(()=>{},()=>{});
	return task;
}
function validResult(data,exp){
	return data&&(data.format==='INITIAL_FIELD_GA_V1'||data.format==='INITIAL_FIELD_GA_V2')&&
		data.experiment&&data.experiment.id===exp.id&&
		Array.isArray(data.experiment.rules)&&data.experiment.rules.join(',')===exp.rules.join(',')&&
		Number.isInteger(data.completed)&&data.completed>=0;
}
function recordProgress(exp,index,completed){
	let runs=experimentProgress.get(exp.id);
	if(!runs){
		runs=Array(exp.runs).fill(undefined);
		experimentProgress.set(exp.id,runs);
	}
	if(index>=0&&index<runs.length)runs[index]=completed;
	updateExperimentLabel(exp);
}
function progressLabel(exp){
	const runs=experimentProgress.get(exp.id);
	if(!runs||runs.some(n=>n===undefined))return 'CHECKING';
	// The requested epoch count belongs to the schedule, not an experiment spec.
	const target=window.InitialGASchedule.EPOCHS;
	const completed=runs.filter(n=>n!==null&&n>=target).length;
	if(completed===exp.runs)return 'COMPLETE '+completed+'/'+exp.runs+' runs';
	const started=runs.filter(n=>n!==null&&n>0);
	if(!started.length)return 'NOT STARTED';
	if(exp.runs===1)return 'IN PROGRESS '+started[0]+'/'+target;
	const total=runs.reduce((sum,n)=>sum+(n===null?0:Math.min(n,target)),0);
	return 'IN PROGRESS '+completed+'/'+exp.runs+' runs complete · '+total+'/'+(exp.runs*target)+' epochs';
}
function updateExperimentLabel(exp){
	const picker=$('experiment');
	for(const option of picker.options){
		if(option.value!==exp.id)continue;
		option.textContent='['+progressLabel(exp)+'] '+exp.ruleFolder+' / '+exp.id;
		break;
	}
}
async function checkExperimentProgress(choices){
	// Fast path: the scanner writes this tiny index after every saved epoch.
	// A script tag (not fetch) works locally in Chrome with file://.
	const ruleFolder=choices[0].ruleFolder;
	let indexed=null;
	try{
		window.InitialFieldGAProgress=null;
		await loadScript('data/'+ruleFolder+'/progress.js');
		indexed=window.InitialFieldGAProgress;
	}catch(err){
		// The old scanner did not create progress.js; scan results.js below.
	}
	if(indexed&&indexed.format==='INITIAL_FIELD_GA_PROGRESS_V1'&&
		indexed.ruleFolder===ruleFolder&&indexed.experiments){
		for(const exp of choices){
			const item=indexed.experiments[exp.id];
			if(!item||!Array.isArray(item.runs))continue;
			for(let i=0;i<exp.runs;i++){
				const count=item.runs[i];
				recordProgress(exp,i,Number.isInteger(count)&&count>=0?count:null);
			}
		}
	}
	// If this is an existing scan that has not yet been restarted with the
	// updated scanner, discover its status directly from saved results.
	for(const exp of choices){
		for(let i=0;i<exp.runs;i++){
			const current=experimentProgress.get(exp.id);
			if(current&&current[i]!==undefined)continue;
			try{
				const data=await readResultsScript(window.InitialGASchedule.runFolder(exp,i)+'/results.js');
				recordProgress(exp,i,validResult(data,exp)?data.completed:null);
			}catch(err){
				recordProgress(exp,i,null);
			}
		}
	}
}

function updateMetricOptions(){
	const selected=DATA.experiment.score==='max_recovery'?'recovery':'flickering';
	const picker=$('metric'),previous=picker.value;
	picker.replaceChildren();
	const names=(DATA.experiment.storedFitness===false)?['current',selected]:['stored','current',selected];
	for(const name of names){
		const option=document.createElement('option');
		option.value=name;option.textContent=metricLabels[name];
		picker.appendChild(option);
	}
	picker.value=[...picker.options].some(option=>option.value===previous)?previous:picker.options[0].value;

}
function combinedData(runs){
	if(!runs.length)return null;
	const first=runs[0].data;
	const completed=Math.max(...runs.map(run=>run.data.completed));
	const metric=first.experiment.score==='max_recovery'?'recovery':'flickering';
	const history=[];
	for(let e=0;e<completed;e++){
		const present=runs.filter(run=>e<run.data.history.length);
		const record={epoch:e+1,A:{},B:{}};
		for(const side of ['A','B']){
			for(const name of ['stored','current',metric]){
				const values=[];
				for(const run of present)values.push(...run.data.history[e][side][name]);
				record[side][name]=values;
			}
		}
		history.push(record);
	}
	const topPairs=[];
	for(const run of runs){
		for(const pair of run.data.topPairs){
			topPairs.push({...pair,runIndex:run.index,key:run.index+':'+pair.key});
		}
	}
	return {...first,completed,history,topPairs,
		runsLoaded:runs.length,runNumbers:runs.map(run=>run.index)};
}
function resetMaxY(){
	if(!DATA||!DATA.history.length){
		$('maxY').value='1';
		return;
	}
	const metric=$('metric').value;
	let maximum=0;
	for(const epoch of DATA.history){
		for(const side of ['A','B']){
			for(const value of epoch[side][metric]){
				if(Number.isFinite(value)&&value>maximum)maximum=value;
		}
		}
	}
	$('maxY').value=String(maximum>0?maximum:1);
}
function chooseRuns(){
	if(!ACTIVE)return;
	const index=Number($('run').value);
	const selected=index?RUNS.filter(run=>run.index===index):RUNS;
	DATA=combinedData(selected);
	selectedPairKey=null;
	if(!DATA){
		clearPreviewField();
		$('completed').textContent='';
		setStatus('No saved data for this selection. Run node scan_ga.js and press F5.');
		blankGraphs();$('topTable').tBodies[0].replaceChildren();
		return;
	}
	updateMetricOptions();
	resetMaxY();
	const counts=selected.map(run=>'run_'+String(run.index).padStart(2,'0')+': '+run.data.completed).join(' · ');
	$('completed').textContent=DATA.completed+' / '+DATA.experiment.epochs+' epochs (latest)';
	setStatus(selected.length+'/'+ACTIVE.runs+' runs loaded · '+counts+
		' · rules '+DATA.experiment.rules.join(' + ')+' · fitness '+DATA.experiment.score+
		' · stored '+(DATA.experiment.storedFitness===false?'off':'on')+
		' · density '+DATA.experiment.initialDensity+' · field '+DATA.experiment.fieldSize[0]+'x'+DATA.experiment.fieldSize[1]);
	if(!$('tab_evolution').hidden)drawGraphs();else drawTopPairs();
}
async function openExperiment(){
	const token=++loadingToken;
	const item=window.InitialGASchedule.uniqueExperiments().find(x=>x.id===$('experiment').value);
	ACTIVE=item;DATA=null;RUNS=[];selectedPairKey=null;
	clearPreviewField();
	if(!item){setStatus('No experiment selected.',true);return;}
	setStatus('Reading run data from '+item.path+'…');
	const picker=$('run');
	picker.replaceChildren();
	const all=document.createElement('option');all.value='0';all.textContent='All available runs';picker.appendChild(all);
	for(let index=0;index<item.runs;index++){
		const url=window.InitialGASchedule.runFolder(item,index)+'/results.js';
		try{
			const data=await readResultsScript(url);
			if(token!==loadingToken)return;
			if(!validResult(data,item))throw Error('Unexpected results.js format in '+url);
			RUNS.push({index:index+1,data});
			recordProgress(item,index,data.completed);
		}catch(err){
			if(token!==loadingToken)return;
			// Missing results.js is normal: the scanner may not have reached this run.
			if(!/Cannot load/.test(err.message))console.warn(err);
			recordProgress(item,index,null);
		}
	}
	if(token!==loadingToken)return;
	for(const run of RUNS){
		const option=document.createElement('option');
		option.value=String(run.index);
		option.textContent='Run '+String(run.index).padStart(2,'0')+' · '+run.data.completed+'/'+run.data.experiment.epochs+' epochs';
		picker.appendChild(option);
	}
	picker.value='0';
	chooseRuns();
}
function blankGraphs(){
	for(const id of ['heatA','heatB','meansAB']){
		const ctx=$(id).getContext('2d');
		ctx.fillStyle='#fff';ctx.fillRect(0,0,GRAPH_W,GRAPH_H);
		ctx.fillStyle='#000';ctx.fillRect(MARGIN_LEFT,MARGIN_TOP,FIG_W,FIG_H);
	}
	$('footA').textContent='';
	$('footB').textContent='';
}
function yMaximum(){
	const value=Number($('maxY').value);
	return Number.isFinite(value)&&value>0?value:255;
}
// Fixed article heatmap gradient. No palette selector.
function color(t){
	const value=Math.round(255*t);
	return [value,value,value];
}
function valToBin(v,yMax){return Math.max(0,Math.min(255,Math.floor(v*255/yMax)));}
function countsForSide(side){
	const metric=$('metric').value,yMax=yMaximum();
	const h=[];let global=1;
	for(const ep of DATA.history){
		const bins=new Uint32Array(256);
		for(const v of ep[side][metric]){
			// A lower Max Y crops out-of-range samples rather than piling them at the top.
			if(Number.isFinite(v)&&v>=0&&v<=yMax)bins[valToBin(v,yMax)]++;
		}
		h.push(bins);
		for(let i=0;i<256;i++)if(bins[i]>global)global=bins[i];
	}
	return {hist:h,global,yMax};
}
function epochMeans(side){
	const metric=$('metric').value;
	return DATA.history.map(ep=>{
		const values=ep[side][metric];
		if(!values.length)return NaN;
		let sum=0;
		for(const value of values)sum+=value;
		return sum/values.length;
	});
}
// Centered moving average across epochs. At either end we use only
// existing epochs; no zero-padding. N=1 returns the original mean series.
function convolveMean(values){
	if(!$('convolution').checked)return values;
	const windowSize=Math.max(1,Math.floor(Number($('convolutionWindow').value)||1));
	if(windowSize===1)return values;
	const left=Math.floor((windowSize-1)/2);
	const right=windowSize-1-left;
	const result=new Array(values.length);
	for(let i=0;i<values.length;i++){
		let sum=0,count=0;
		for(let j=Math.max(0,i-left);j<=Math.min(values.length-1,i+right);j++){
			if(!Number.isFinite(values[j]))continue;
			sum+=values[j];
			count++;
		}
		result[i]=count?sum/count:NaN;
	}
	return result;
}
function displayedMeans(side){
	return convolveMean(epochMeans(side));
}
function tickNumber(n){
	return Number(n.toFixed(5)).toLocaleString('en-US',{maximumFractionDigits:5});
}
function drawAxis(ctx,yMax){
	ctx.strokeStyle='#777';ctx.lineWidth=1;
	ctx.strokeRect(MARGIN_LEFT-0.5,MARGIN_TOP-0.5,FIG_W+1,FIG_H+1);
	ctx.font='12px Arial';ctx.fillStyle='#222';ctx.textBaseline='middle';
	for(let i=0;i<=4;i++){
		const value=yMax>=4 ? Math.round(yMax*i/4) : yMax*i/4;
		const y=MARGIN_TOP+FIG_H-1-Math.round(value/yMax*(FIG_H-1));
		ctx.textAlign='right';ctx.fillStyle='#222';ctx.fillText(tickNumber(value),MARGIN_LEFT-9,y);
		if($('grid').checked&&i>0&&i<4){
			ctx.strokeStyle='#333';ctx.beginPath();ctx.moveTo(MARGIN_LEFT,y+0.5);ctx.lineTo(MARGIN_LEFT+FIG_W,y+0.5);ctx.stroke();
		}
	}
	ctx.fillStyle='#222';ctx.textAlign='center';ctx.textBaseline='top';
	const total=DATA.experiment.epochs;
	const epochTicks=new Set([1,total]);
	for(let j=1;j<4;j++)epochTicks.add(Math.max(1,Math.round(total*j/4)));
	for(const epoch of Array.from(epochTicks).sort((a,b)=>a-b)){
		const x=MARGIN_LEFT+(epoch-0.5)/total*FIG_W;
		ctx.fillText(epoch.toLocaleString('en-US'),x,MARGIN_TOP+FIG_H+10);
	}
	ctx.fillText('Epoch',MARGIN_LEFT+FIG_W/2,MARGIN_TOP+FIG_H+32);
}
function drawMeanLine(ctx,values,yMax,stroke,thickness){
	if(!values.length)return;
	ctx.save();
	ctx.beginPath();ctx.rect(MARGIN_LEFT,MARGIN_TOP,FIG_W,FIG_H);ctx.clip();
	ctx.beginPath();
	const total=DATA.experiment.epochs;
	let started=false;
	for(let e=0;e<values.length;e++){
		if(!Number.isFinite(values[e])){started=false;continue;}
		const x=MARGIN_LEFT+(e+0.5)/total*FIG_W;
		const y=MARGIN_TOP+FIG_H-1-values[e]/yMax*(FIG_H-1);
		if(!started){ctx.moveTo(x,y);started=true;}else ctx.lineTo(x,y);
	}
	// Also show one-epoch data (a path with a single point would be invisible).
	if(values.length===1&&Number.isFinite(values[0])){
		const x=MARGIN_LEFT+0.5/total*FIG_W;
		const y=MARGIN_TOP+FIG_H-1-values[0]/yMax*(FIG_H-1);
		ctx.moveTo(x-2,y);ctx.lineTo(x+2,y);
	}
	ctx.strokeStyle=stroke;ctx.lineWidth=thickness;ctx.lineJoin='round';ctx.stroke();
	ctx.restore();
}
function drawGraph(side){
	const canvas=$('heat'+side),ctx=canvas.getContext('2d');
	ctx.fillStyle='#fff';ctx.fillRect(0,0,GRAPH_W,GRAPH_H);
	ctx.fillStyle='#000';ctx.fillRect(MARGIN_LEFT,MARGIN_TOP,FIG_W,FIG_H);
	const {hist,global,yMax}=countsForSide(side);
	const gamma=Math.max(0.05,Math.min(3,Number($('gamma').value)||0.4));
	const normalize=$('normalize').value,linear=$('brightness').value==='linear';
	const img=ctx.createImageData(FIG_W,FIG_H);
	for(let p=3;p<img.data.length;p+=4)img.data[p]=255;
	const maxEpoch=DATA.experiment.epochs;
	for(let x=0;x<FIG_W;x++){
		const epoch=Math.floor(x*maxEpoch/FIG_W);
		if(epoch>=hist.length)continue;
		const bins=hist[epoch];
		let local=global;
		if(normalize==='epoch'){
			local=1;
			for(let b=0;b<256;b++)if(bins[b]>local)local=bins[b];
		}
		for(let b=0;b<256;b++){
			const frequency=bins[b];
			if(!frequency)continue;
			const normalized=linear?frequency/local:Math.log1p(frequency)/Math.log1p(local);
			const rgb=color(Math.pow(normalized,gamma));
			const y=255-b;
			for(let oy=0;oy<2;oy++){
				const off=((y*2+oy)*FIG_W+x)*4;
				img.data[off]=rgb[0];img.data[off+1]=rgb[1];img.data[off+2]=rgb[2];img.data[off+3]=255;
			}
		}
	}
	ctx.putImageData(img,MARGIN_LEFT,MARGIN_TOP);
	if($('showMean').checked){
		const values=displayedMeans(side);
		// Dark outline keeps the optional mean curve visible over bright bins.
		drawMeanLine(ctx,values,yMax,'#222',4);
		drawMeanLine(ctx,values,yMax,side==='A'?'#ff00ff':'#00eaff',2);
	}
	drawAxis(ctx,yMax);
	const last=DATA.history[DATA.history.length-1];
	const arr=last[side][$('metric').value];
	let mean=0,highest=0;
	for(const v of arr){mean+=v;if(v>highest)highest=v;}
	$('foot'+side).textContent=metricLabels[$('metric').value]+' · last epoch: mean '+format(mean/arr.length)+' · best '+format(highest);
}
function drawMeans(){
	const ctx=$('meansAB').getContext('2d'),yMax=yMaximum();
	ctx.fillStyle='#fff';ctx.fillRect(0,0,GRAPH_W,GRAPH_H);
	ctx.fillStyle='#000';ctx.fillRect(MARGIN_LEFT,MARGIN_TOP,FIG_W,FIG_H);
	if($('grid').checked){
		for(let i=1;i<4;i++){
			const y=MARGIN_TOP+FIG_H-1-Math.round(i/4*(FIG_H-1));
			ctx.strokeStyle='#333';ctx.beginPath();ctx.moveTo(MARGIN_LEFT,y+0.5);ctx.lineTo(MARGIN_LEFT+FIG_W,y+0.5);ctx.stroke();
		}
	}
	const meanA=displayedMeans('A'),meanB=displayedMeans('B');
	drawMeanLine(ctx,meanA,yMax,'#ff00ff',2);
	drawMeanLine(ctx,meanB,yMax,'#00eaff',2);
	drawAxis(ctx,yMax);
	$('footMeans').title='Last epoch: A '+format(meanA[meanA.length-1])+'; B '+format(meanB[meanB.length-1]);
}
function drawGraphs(){
	if(!DATA||!DATA.completed){blankGraphs();return;}
	drawGraph('A');drawGraph('B');drawMeans();
}
function graphHover(event,side){
	if(!DATA)return;
	const canvas=event.currentTarget,rect=canvas.getBoundingClientRect();
	const x=(event.clientX-rect.left)*canvas.width/rect.width-MARGIN_LEFT;
	const y=(event.clientY-rect.top)*canvas.height/rect.height-MARGIN_TOP;
	if(x<0||x>=FIG_W||y<0||y>=FIG_H)return;
	const e=Math.floor(x/FIG_W*DATA.experiment.epochs);
	if(e>=DATA.completed)return;
	const {hist,yMax}=countsForSide(side);
	const bin=Math.floor((FIG_H-y-1)/2);
	const low=bin/255*yMax,high=(bin+1)/255*yMax;
	$('readout').textContent='Population '+side+' | epoch '+(e+1)+
		' | '+metricLabels[$('metric').value]+' in ['+format(low)+', '+format(high)+')'+
		' | '+hist[e][Math.max(0,Math.min(255,bin))]+' of '+DATA.history[e][side][$('metric').value].length+' individuals';
}
function meanHover(event){
	if(!DATA||!DATA.completed)return;
	const canvas=event.currentTarget,rect=canvas.getBoundingClientRect();
	const x=(event.clientX-rect.left)*canvas.width/rect.width-MARGIN_LEFT;
	if(x<0||x>=FIG_W)return;
	const epoch=Math.floor(x/FIG_W*DATA.experiment.epochs);
	if(epoch>=DATA.completed)return;
	const metric=$('metric').value;
	const a=displayedMeans('A')[epoch],b=displayedMeans('B')[epoch];
	$('readout').textContent='Epoch '+(epoch+1)+' | '+metricLabels[metric]+
		' | A mean '+format(a)+' | B mean '+format(b);
}
function pairDecode(base64){
	const raw=atob(base64),result=new Uint8Array(raw.length);
	for(let i=0;i<raw.length;i++)result[i]=raw.charCodeAt(i);
	return result;
}
function bit(bytes,index){return (bytes[index>>>3]>>>(index&7))&1;}
function drawPreviewField(){
	const canvas=$('pairPreview'),ctx=canvas.getContext('2d');
		if(!previewApi)return;
	if(!previewPixels||previewPixels.width!==previewApi.WIDTH||previewPixels.height!==previewApi.HEIGHT)previewPixels=ctx.createImageData(previewApi.WIDTH,previewApi.HEIGHT);
	const pixels=previewPixels.data;
	for(let i=0;i<previewApi.CELLS;i++){
		const value=previewField&&previewField[i]?255:0;
		const p=i*4;
		pixels[p]=value;
		pixels[p+1]=value;
		pixels[p+2]=value;
		pixels[p+3]=255;
	}
	ctx.putImageData(previewPixels,0,0);
	$('previewSteps').textContent='Steps: '+previewStep;
}
function clearPreviewField(){
	previewField=null;
	previewNext=null;
	previewApi=null;
	previewPixels=null;
	previewStep=0;
	drawPreviewField();
	$('pairDetails').textContent='Select a table row.';
}
function loadPreviewField(entry){
	const size=DATA.experiment.fieldSize[0];
	previewApi=InitialCAPreview.create(size);
	const canvas=$('pairPreview');
	canvas.width=previewApi.WIDTH;
	canvas.height=previewApi.HEIGHT;
	previewPixels=null;
	const a=pairDecode(entry.fieldA),b=pairDecode(entry.fieldB);
	previewField=previewApi.assemble(a,b);
	previewNext=new Uint8Array(previewApi.CELLS);
	previewRuleA=window.InitialGASchedule.ruleToId(DATA.experiment.rules[0]);
	previewRuleB=window.InitialGASchedule.ruleToId(DATA.experiment.rules[1]);
	previewStep=0;
	drawPreviewField();
	// Deliberately do not call stopPreview() here. A running interval continues
	// immediately with the newly selected field, starting at step 1.
}
function previewOneStep(){
	if(!previewField)return;
	previewApi.advance(previewField,previewNext,(previewStep&1)?previewRuleB:previewRuleA);
	const old=previewField;
	previewField=previewNext;
	previewNext=old;
	previewStep++;
	drawPreviewField();
}
function startPreview(){
	if(previewTimer!==null||!previewField)return;
	previewTimer=setInterval(previewOneStep,1);
}
function stopPreview(){
	if(previewTimer===null)return;
	clearInterval(previewTimer);
	previewTimer=null;
}
function clearSelectedPreview(){
	if(!selectedPairKey)return;
	const entry=topShown.find(x=>x.key===selectedPairKey);
	if(!entry)return;
	loadPreviewField(entry);
}
function previewCountWithStop(){
	if(!previewField)return;
	const amount=Math.max(1,Math.round(Number($('previewCountValue').value)||1));
	let remaining=amount;
	stopPreview();
	previewTimer=setInterval(()=>{
		if(!previewField){stopPreview();return;}
		previewOneStep();
		remaining--;
		if(remaining<=0)stopPreview();
	},1);
}
function selectTop(key){
	const entry=topShown.find(x=>x.key===key);
	if(!entry)return;
	const changed=selectedPairKey!==key||!previewField;
	selectedPairKey=key;
	for(const row of $('topTable').tBodies[0].rows)row.classList.toggle('selected',row.dataset.key===key);
	if(changed)loadPreviewField(entry);
	const total=DATA.experiment.fieldSize[0]*DATA.experiment.fieldSize[1];
	$('pairDetails').textContent='Run '+String(entry.runIndex).padStart(2,'0')+', epoch '+entry.epoch+', A #'+entry.aIndex+', B #'+entry.bIndex+
		'\nFitness A: '+entry.scoreA+' | Fitness B: '+entry.scoreB+
		'\nInitial density: A '+entry.densityA+'/'+total+' ('+(100*entry.densityA/total).toFixed(2)+'%)'+
		', B '+entry.densityB+'/'+total+' ('+(100*entry.densityB/total).toFixed(2)+'%)';
}
function drawTopPairs(){
	if(!DATA){$('topTable').tBodies[0].replaceChildren();clearPreviewField();return;}
	const field=$('topSort').value;
	const count=Math.max(1,Math.min(120,Math.round(Number($('topCount').value)||10)));
	topShown=DATA.topPairs.slice().sort((a,b)=>b[field]-a[field]||b.joint-a.joint).slice(0,count);
	const tbody=$('topTable').tBodies[0];tbody.replaceChildren();
	for(let i=0;i<topShown.length;i++){
		const p=topShown[i],tr=document.createElement('tr');
		tr.tabIndex=0;tr.dataset.key=p.key;
		for(const value of [i+1,p.runIndex,p.epoch,p.aIndex,p.bIndex,format(p.joint),p.scoreA,p.scoreB]){
			const td=document.createElement('td');td.textContent=value;tr.appendChild(td);
		}
		tr.addEventListener('click',()=>selectTop(p.key));
		tr.addEventListener('keydown',ev=>{
			if(ev.key==='Enter'){selectTop(p.key);return;}
			if(ev.key!=='ArrowDown'&&ev.key!=='ArrowUp')return;
			ev.preventDefault();
			const next=Math.max(0,Math.min(topShown.length-1,i+(ev.key==='ArrowDown'?1:-1)));
			const target=tbody.rows[next];if(target){target.focus({preventScroll:true});selectTop(topShown[next].key);}
		});
		tbody.appendChild(tr);
	}
	if(topShown.length)selectTop(topShown.some(x=>x.key===selectedPairKey)?selectedPairKey:topShown[0].key);
	else{selectedPairKey=null;clearPreviewField();$('pairDetails').textContent='No saved pairs yet.';}
}
function init(){
	const choices=window.InitialGASchedule.uniqueExperiments();
	const select=$('experiment');
	for(const exp of choices){
		const option=document.createElement('option');option.value=exp.id;
		option.textContent='[CHECKING] '+exp.ruleFolder+' / '+exp.id;
		select.appendChild(option);
	}
	for(const tab of document.querySelectorAll('.tab'))tab.addEventListener('click',()=>chooseTab(tab.dataset.tab));
	$('previewStart').addEventListener('click',startPreview);
	$('previewStop').addEventListener('click',stopPreview);
	$('previewClear').addEventListener('click',clearSelectedPreview);
	$('previewOneStep').addEventListener('click',previewOneStep);
	$('previewCountStop').addEventListener('click',previewCountWithStop);
	select.addEventListener('change',openExperiment);
	$('run').addEventListener('change',chooseRuns);
	$('metric').addEventListener('change',()=>{resetMaxY();drawGraphs();});
	for(const id of ['brightness','normalize','gamma','maxY','showMean','convolution','convolutionWindow','grid'])$(id).addEventListener('change',drawGraphs);
	for(const id of ['topSort','topCount'])$(id).addEventListener('change',drawTopPairs);
	for(const side of ['A','B'])$('heat'+side).addEventListener('mousemove',e=>graphHover(e,side));
	$('meansAB').addEventListener('mousemove',meanHover);
	blankGraphs();
	clearPreviewField();
	if(choices.length){
		openExperiment();
		checkExperimentProgress(choices).catch(err=>console.warn('Progress check failed',err));
	}else setStatus('No experiments in schedule.js.',true);
}
init();
