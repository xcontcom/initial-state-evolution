'use strict';

// Fixed outer-totalistic rules, bit 0 first. A applies on odd steps, B on
// even steps, across the entire joined torus.
const RULES = ['000100000001100000', '000100000001100000'];
const POPULATION_SIZE = 200; // 200 A fields + 200 B fields, separately evolved
const EPOCHS = 500;
const TOP_PAIR_LIMIT = 40;
const BASE_SEED = null; // null: each new run gets a saved random seed

// [minFlips, maxFlips, independent reruns, fitness metric,
//  stored fitness, initial density, field size]
const EXPERIMENTS = [
	[1,89,1,'flickering',true,0.1,89],
	[1,89,1,'flickering',false,0.1,89],
	[1,89,1,'flickering',true,0.5,89],
	[1,89,1,'flickering',false,0.5,89],
	[1,89,1,'max_recovery',true,0.5,89]
];

function ruleToId(bits){
	if(typeof bits!=='string'||!/^[01]{18}$/.test(bits))throw Error('Expected 18-bit rule: '+bits);
	let id=0;
	for(let i=0;i<18;i++)if(bits[i]==='1')id|=1<<i;
	return id;
}
function rulePairFolder(){
	if(!Array.isArray(RULES)||RULES.length!==2)throw Error('RULES must contain two 18-bit rules');
	const a=ruleToId(RULES[0]),b=ruleToId(RULES[1]);
	return [a&511,a>>>9,b&511,b>>>9].join('_');
}
function densityTag(density){
	return String(Math.round(density*1000)).padStart(4,'0');
}
function resolveExperiment(spec){
	if(!Array.isArray(spec)||spec.length!==7)throw Error('Use [minFlips,maxFlips,reruns,score,storedFitness,initialDensity,fieldSize]');
	const [minFlips,maxFlips,runs,score,storedFitness,initialDensity,fieldSize]=spec;
	if(score!=='max_recovery'&&score!=='flickering')throw Error('Invalid fitness metric');
	if(storedFitness!==true&&storedFitness!==false)throw Error('storedFitness must be true/false');
	if(!Number.isFinite(initialDensity)||initialDensity<0||initialDensity>1)throw Error('initialDensity must be in [0,1]');
	if(!Number.isInteger(fieldSize)||fieldSize<1)throw Error('fieldSize must be positive integer');
	if(!Number.isInteger(minFlips)||!Number.isInteger(maxFlips)||
		minFlips<1||maxFlips>fieldSize*fieldSize||minFlips>maxFlips)throw Error('Invalid mutation range');
	if(!Number.isSafeInteger(runs)||runs<1)throw Error('Reruns must be positive integer');
	const storeTag=storedFitness?'stored':'current';
	const fieldTag='f'+String(fieldSize).padStart(3,'0');
	const densityPart='d'+densityTag(initialDensity);
	const mutationTag='mut'+String(minFlips).padStart(3,'0')+'_'+String(maxFlips).padStart(3,'0');
	const id=score+'_'+storeTag+'_'+densityPart+'_'+fieldTag+'/'+mutationTag;
	const ruleA=ruleToId(RULES[0]);
	const ruleB=ruleToId(RULES[1]);
	const ruleFolder=rulePairFolder();
	return {
		minFlips,maxFlips,runs,score,storedFitness,initialDensity,fieldSize,id,
		ruleA,ruleB,ruleFolder,rules:RULES.slice(),path:'data/'+ruleFolder+'/'+id
	};
}
function uniqueExperiments(){
	const experiments=new Map();
	for(const spec of EXPERIMENTS){
		const exp=resolveExperiment(spec);
		const old=experiments.get(exp.id);
		if(old&&exp.runs<=old.runs)throw Error('Repeated experiment must increase the number of reruns: '+exp.id);
		experiments.set(exp.id,exp);
	}
	return [...experiments.values()];
}
function runFolder(exp,index){
	if(!Number.isInteger(index)||index<0||index>=exp.runs)throw Error('Invalid run index');
	return exp.path+'/run_'+String(index+1).padStart(2,'0');
}
const api={RULES,POPULATION_SIZE,EPOCHS,TOP_PAIR_LIMIT,BASE_SEED,EXPERIMENTS,
	ruleToId,rulePairFolder,resolveExperiment,uniqueExperiments,runFolder};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else window.InitialGASchedule=api;
