var Bigchain = require('../core.js');
var utils = require('../db/utils.js');
var MongoClient = require('mongodb').MongoClient;
//var async = require('async');

if (process.argv.length <= 2) {
    console.log("In: " + __filename + "\nErrore inserimento parametri ");
    process.exit(-1);
};

var op = process.argv[2]
switch(op){
	case 'init':
		utils.init();
		break;
	case 'start':
		utils.start();
		break;
	case 'drop':
		utils.drop();
		break;
	case 'voting':
		utils.voting();
		break;
	default:
		console.log("Nothing to do there..");
};

//per inizializzare il db richiamo il metodo 'init()' esportato dal modulo 'utils'

//console.log("inizializzazione completata");
