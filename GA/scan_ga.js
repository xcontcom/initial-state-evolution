'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {newRng,seedForRun}=require('./rng');
const {POPULATION_SIZE,EPOCHS,TOP_PAIR_LIMIT,BASE_SEED,uniqueExperiments,runFolder}=require('./schedule');
const {initializePopulation,serializePopulation,deserializePopulation,
	packFieldToBase64,shuffle,evolveOnePopulation,populationDensity}=require('./ga_core');
const {simulate,FINAL_STEP}=require('./ca_core');

function check(ok,msg){if(!ok)throw Error(msg);}
function atomicWrite(filename,data){
	fs.mkdirSync(path.dirname(filename),{recursive:true});
	const tmp=filename+'.tmp';
	fs.writeFileSync(tmp,data);
	fs.renameSync(tmp,filename);
}
function jsonFile(filename,value){atomicWrite(filename,JSON.stringify(value));}
function loadJson(filename){return JSON.parse(fs.readFileSync(filename,'utf8'));}
function directory(exp,index){return path.join(__dirname,runFolder(exp,index));}
function metadataConfig(exp){
	return {
		format:'INITIAL_FIELD_GA_V2',rules:exp.rules,score:exp.score,
		minFlips:exp.minFlips,maxFlips:exp.maxFlips,epochs:EPOCHS,populationSize:POPULATION_SIZE,
		fieldSize:[exp.fieldSize,exp.fieldSize],joinedSize:[exp.fieldSize*2,exp.fieldSize],
		initialDensity:exp.initialDensity,storedFitness:exp.storedFitness,topPairLimit:TOP_PAIR_LIMIT,
		steps:FINAL_STEP,
		...(exp.score==='max_recovery'?{signatureWindow:[256,512],signatureLength:8}:{}),
		selection:'independent-top-half-A-and-B',
		crossover:'independent-reciprocal-uniform-per-bit',
		fitness:'A-receives-B-measurement;B-receives-A-measurement',
		pairing:'identity-A-random-permutation-B;each-used-once-per-epoch'
	};
}
function initialize(exp,index){
	const dir=directory(exp,index),metaPath=path.join(dir,'metadata.json'),cpPath=path.join(dir,'checkpoint.json');
	const config=metadataConfig(exp);
	let metadata;
	if(fs.existsSync(metaPath)){
		metadata=loadJson(metaPath);
		check(JSON.stringify(metadata.config)===JSON.stringify(config),'Saved metadata differs; choose a new experiment directory: '+dir);
		check(Number.isInteger(metadata.baseSeed)&&metadata.baseSeed>=0&&metadata.baseSeed<=0xffffffff,'Invalid saved base seed: '+dir);
		if(BASE_SEED!==null)check(metadata.baseSeed===seedForRun(BASE_SEED,index),'Base seed mismatch');
	}else{
		check(!fs.existsSync(cpPath),'Checkpoint exists without metadata: '+dir);
		const baseSeed=BASE_SEED===null?crypto.randomBytes(4).readUInt32LE(0):seedForRun(BASE_SEED,index);
		check(Number.isInteger(baseSeed)&&baseSeed>=0&&baseSeed<=0xffffffff,'Invalid BASE_SEED');
		metadata={baseSeed,config};
		jsonFile(metaPath,metadata);
	}
	const rng=newRng(metadata.baseSeed);
	let state;
	if(fs.existsSync(cpPath)){
		const cp=loadJson(cpPath);
		check(Number.isInteger(cp.completed)&&cp.completed>=0&&cp.completed<=EPOCHS,'Bad checkpoint epoch');
		check(Number.isInteger(cp.rng)&&cp.rng>=0&&cp.rng<=0xffffffff,'Bad checkpoint RNG');
		rng.state=cp.rng;
		check(Array.isArray(cp.history)&&cp.history.length===cp.completed,'Bad checkpoint history');
		check(Array.isArray(cp.topPairs),'Bad checkpoint top pairs');
		state={completed:cp.completed,rng,
			A:deserializePopulation(cp.A,POPULATION_SIZE,exp.fieldSize),
			B:deserializePopulation(cp.B,POPULATION_SIZE,exp.fieldSize),
			history:cp.history,topPairs:cp.topPairs};
	}else{
		state={completed:0,rng,
			A:initializePopulation(POPULATION_SIZE,rng,exp.fieldSize,exp.initialDensity),
			B:initializePopulation(POPULATION_SIZE,rng,exp.fieldSize,exp.initialDensity),
			history:[],topPairs:[]};
	}
	writeViewData(dir,exp,state);
	return state;
}
function save(dir,exp,state){
	jsonFile(path.join(dir,'checkpoint.json'),{
		completed:state.completed,rng:state.rng.state,
		A:serializePopulation(state.A),B:serializePopulation(state.B),
		history:state.history,topPairs:state.topPairs
	});
	writeViewData(dir,exp,state);
}
function writeViewData(dir,exp,state){
	const payload={format:'INITIAL_FIELD_GA_V2',experiment:{
		id:exp.id,ruleFolder:exp.ruleFolder,rules:exp.rules,score:exp.score,
		minFlips:exp.minFlips,maxFlips:exp.maxFlips,
		storedFitness:exp.storedFitness,initialDensity:exp.initialDensity,
		fieldSize:[exp.fieldSize,exp.fieldSize],joinedSize:[exp.fieldSize*2,exp.fieldSize],
		epochs:EPOCHS,populationSize:POPULATION_SIZE
	},completed:state.completed,history:state.history,topPairs:state.topPairs};
	atomicWrite(path.join(dir,'results.js'),'window.InitialFieldGAPayload='+JSON.stringify(payload)+';\n');
}
function selectedMetric(m,exp){return m[exp.score];}
function topPairKey(a,b){return crypto.createHash('sha256').update(a).update(b).digest('hex');}
function capturePair(exp,epoch,aIndex,bIndex,a,b,outcome){
	const scoreA=selectedMetric(outcome.B,exp);
	const scoreB=selectedMetric(outcome.A,exp);
	return {epoch,aIndex:aIndex+1,bIndex:bIndex+1,scoreA,scoreB,
		joint:(scoreA+scoreB)/2,
		densityA:populationDensity(a,exp.fieldSize),densityB:populationDensity(b,exp.fieldSize),
		fieldA:packFieldToBase64(a),fieldB:packFieldToBase64(b),
		key:topPairKey(a,b)};
}
function updateTopPairs(state,candidates){
	const pool=new Map();
	for(const pair of state.topPairs.concat(candidates)){
		const previous=pool.get(pair.key);
		if(!previous||pair.joint>previous.joint)pool.set(pair.key,pair);
	}
	const all=Array.from(pool.values());
	const chosen=new Map();
	for(const metric of ['joint','scoreA','scoreB']){
		for(const pair of all.slice().sort((a,b)=>b[metric]-a[metric]||a.epoch-b.epoch).slice(0,TOP_PAIR_LIMIT))chosen.set(pair.key,pair);
	}
	state.topPairs=Array.from(chosen.values()).sort((a,b)=>b.joint-a.joint);
}
function summarize(values){
	let sum=0,max=-Infinity;
	for(const v of values){sum+=v;if(v>max)max=v;}
	return {mean:sum/values.length,max};
}
function runEpoch(exp,state){
	const n=POPULATION_SIZE;
	const bOrder=shuffle(Array.from({length:n},(_,i)=>i),state.rng);
	const metric=exp.score==='max_recovery'?'recovery':'flickering';
	const A={current:new Array(n),stored:new Array(n),[metric]:new Array(n)};
	const B={current:new Array(n),stored:new Array(n),[metric]:new Array(n)};
	const candidates=[];
	const started=process.hrtime.bigint();
	let i=0;
	function one(){
		const j=bOrder[i],pa=state.A[i],pb=state.B[j];
		const result=simulate(pa.field,pb.field,exp.ruleA,exp.ruleB,exp.score,exp.fieldSize);
		const scoreA=selectedMetric(result.B,exp),scoreB=selectedMetric(result.A,exp);
		pa.best=exp.storedFitness&&pa.best!==null?Math.max(pa.best,scoreA):scoreA;
		pb.best=exp.storedFitness&&pb.best!==null?Math.max(pb.best,scoreB):scoreB;
		A.current[i]=scoreA;A.stored[i]=pa.best;A[metric][i]=scoreA;
		B.current[j]=scoreB;B.stored[j]=pb.best;B[metric][j]=scoreB;
		candidates.push(capturePair(exp,state.completed+1,i,j,pa.field,pb.field,result));
		i++;
	}
	return new Promise((resolve,reject)=>{
		function next(){
			try{
				if(i<n){one();setImmediate(next);return;}
				const elapsed=Number(process.hrtime.bigint()-started)/1e9;
				updateTopPairs(state,candidates);
				state.history.push({epoch:state.completed+1,A,B});
				state.A=evolveOnePopulation(state.A,state.rng,exp.minFlips,exp.maxFlips,exp.fieldSize,exp.storedFitness);
				state.B=evolveOnePopulation(state.B,state.rng,exp.minFlips,exp.maxFlips,exp.fieldSize,exp.storedFitness);
				state.completed++;
				resolve({elapsed,A:summarize(A.stored),B:summarize(B.stored),
					currentA:summarize(A.current),currentB:summarize(B.current)});
			}catch(err){reject(err);}
		}
		next();
	});
}
function eta(seconds){
	if(!Number.isFinite(seconds))return '--';
	let s=Math.max(0,Math.round(seconds));
	const h=Math.floor(s/3600);s%=3600;
	const m=Math.floor(s/60);s%=60;
	return h+'h '+m+'m '+s+'s';
}
async function runExperiment(exp,index,position,total,signal){
	const dir=directory(exp,index),state=initialize(exp,index);
	console.log('\n['+position+'/'+total+'] '+exp.ruleFolder+' / '+exp.id+' / run_'+String(index+1).padStart(2,'0'));
	console.log('Rules '+exp.rules.join(' + ')+' | score '+exp.score+' | stored '+exp.storedFitness+
		' | density '+exp.initialDensity+' | field '+exp.fieldSize+'x'+exp.fieldSize+
		' | '+POPULATION_SIZE+' A and '+POPULATION_SIZE+' B | '+EPOCHS+' epochs | '+exp.minFlips+'..'+exp.maxFlips+' flips');
	const at=process.hrtime.bigint();let evaluated=0;
	while(state.completed<EPOCHS&&!signal.stop){
		const info=await runEpoch(exp,state);
		save(dir,exp,state);
		evaluated++;
		const t=Number(process.hrtime.bigint()-at)/1e9;
		console.log('e'+String(state.completed).padStart(4,'0')+
			' | A best '+info.A.max.toFixed(2)+' mean '+info.A.mean.toFixed(2)+
			' | B best '+info.B.max.toFixed(2)+' mean '+info.B.mean.toFixed(2)+
			' | A current '+info.currentA.mean.toFixed(2)+' B current '+info.currentB.mean.toFixed(2)+
			' | epoch '+info.elapsed.toFixed(1)+'s | ETA '+eta((EPOCHS-state.completed)*t/evaluated));
	}
	console.log(signal.stop?'Stopped safely after committed epoch '+state.completed:'Complete '+exp.id+' / run_'+String(index+1).padStart(2,'0'));
}
async function main(){
	check(POPULATION_SIZE>=4&&POPULATION_SIZE%4===0,'POPULATION_SIZE must be divisible by four');
	check(Number.isInteger(EPOCHS)&&EPOCHS>=1,'Bad epoch count');
	const queue=uniqueExperiments(),signal={stop:false};
	process.on('SIGINT',()=>{signal.stop=true;console.log('\nCtrl+C: finishing this epoch before saving.');});
	process.on('SIGTERM',()=>{signal.stop=true;console.log('\nStop requested: finishing this epoch before saving.');});
	let position=0;
	const total=queue.reduce((sum,exp)=>sum+exp.runs,0);
	for(const exp of queue){
		for(let i=0;i<exp.runs;i++){
			if(signal.stop)break;
			await runExperiment(exp,i,++position,total,signal);
		}
		if(signal.stop)break;
	}
}
main().catch(err=>{console.error(err.stack||err);process.exitCode=1;});
