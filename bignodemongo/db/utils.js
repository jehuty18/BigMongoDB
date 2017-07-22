var MongoClient = require('mongodb').MongoClient;
var Bigchain = require('../core.js').Bigchain;
var async = require('async');
var Main = require('../main.js').Main;

main = new Main()

//progetto la funzione 'createIndex' per poter essere esportata ed allo stesso tempo utilizzata all'interno
//di questo stesso modulo nel caso fosse necessario
var createIndex = exports.createIndex = function(db, collName, indexName, field, callback){
	db.collection(collName).createIndex(
		field,
		{name : indexName},
		function(err,indexName){
			callback();
		}
		);
};

//inizializzazione del db
var init = exports.init = function(){
	//connettendosi al db creerà automaticamente il db 'bigchain'
	var url = 'mongodb://localhost:27017/Bigchain2';
	
	MongoClient.connect(url,function(err,db){
		console.log("ready to initiate..");

		//in async vengono eseguite delle funzioni atomicamente
		async.parallel([
			function(callback){
				//creo la collection 'backlog'
				db.createCollection('backlog',{w:1},function(err,collection){
					callback();
				});
			},
			function(callback){
				//creo la collection 'bigchain'
				db.createCollection('bigchain',{w:1},function(err,collection){
					callback();
				});
			},
			function(callback){
				createIndex(db,'bigchain','block_timestamp',{"block.timestamp":1},function(err){
					callback();
				});
			},
			function(callback){
				createIndex(db,'bigchain','block_number',{"block.block_number":1},function(err){
					callback();
				});
			},
			function(callback){
				createIndex(db,'bigchain','transaction_id',{"block.transactions._id":1},function(err){
					callback();
				});
			},
			function(callback){
				createIndex(db,'bigchain','payload_hash',{"block.transactions.transaction.data.hash":1},function(err){
					callback();
				});
			},
			function(callback){
				createIndex(db,'backlog','transaction_timestamp',{"transaction.timestamp":1},function(err){
					callback();
				});
			},
			function(callback){
				createIndex(db,'backlog','assignee__transaction_timestamp',{"assignee":1,"transaction.timestamp":1},function(err){
					callback();
				});
			},
			function(callback){
				//al termine della inizializzazione e indicizzazione, procedo alla creazione del 'genesis_block'
				//passando come primo parametro la connessione al db
				var b = new Bigchain();
				b.constructor('localhost',27017,db['databaseName']);
				b.create_genesis_block(db,function(err){
					callback();
				});
			}
			],
			//al termine della fase di init, chiudo la connessione al db 
			function(err){
				console.log("done, have fun!");
				db.close();
			});
		})
}

var drop = exports.drop = function(){
	var url = 'mongodb://localhost:27017/Bigchain2';
	
	MongoClient.connect(url,function(err,db){
		console.log('Ready to drop..(?!)');
		try{	
			db.dropDatabase(function(err){
				console.log('Db: '+db['databaseName']+" dropped..");
				db.close();
			});
		}
		catch(e){
			console.log("db non esiste "+e);
		}
	});
}

var start = exports.start = function(){

	//var main = new Main();
	console.log("Starting Bignodemongo main process");
	main.start();
}

var voting = exports.voting = function(){

	//var main = new Main();
	console.log('starting voting process');
	main.voting_process();
}