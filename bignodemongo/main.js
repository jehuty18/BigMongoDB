var MongoClient = require('mongodb').MongoClient;
var functions = require('./functions.js');
var cluster = require('cluster');
var Bigchain = require('./core.js').Bigchain;
var async = require('async');


var Main = exports.Main = function(){

	var block = [];//variabile utilizzata per gestire il blocco creato in più functions
	var b = new Bigchain();
	var i = 1; //contatore fino a 1000 transazioni
	var tx_for_block = []; //array di transazioni recuperato da cursor
	var last_voted = null; //variabile inizializzata a null per l'ultimo blocco della catena votato
	//var block_number;
	var validity;
	//var previous_block_number;
	var previous_block_id;
	var vote;
	var exit; //variabile di controllo utilizzata all'interno del primo while per l'uscita anticipata
	var invalid_reason = null;

	this.start = function(){

			//escluse le funzioni di mappi di bigchain, procedo al recupero direttamente da backlog
			console.log('Initializing BigchainDB processes..');
			var url = 'mongodb://localhost:27017/Bigchain2';

			MongoClient.connect(url,function(err,db){
				console.log('let\'s get started!');
				//le variabili sono inizializzate di seguito per renderle globali per le funzioni di 'async'

				b.constructor("localhost",27017,db);
				var backlog = db.collection('backlog');
				var cursor = backlog.find()//cursore per il recupero di tutte le transazioni inserite in backlog


				async.series([
					function(callback){
						//controllo se sono presenti transazioni in backlog
						backlog.count(function(err,count){
							if(count <= 0){
								throw('empty backlog');
							}
							else{
								callback();
							}
						})
					},
					//filter_by_assignee  -> validate_transaction - create_block
					function(callback){
						//esamina tutti gli elementi recuperati dalla find()
						cursor.each(function(err,doc){
							if(doc != null)	{
								tx_for_block.push(doc)

								if(i == 1000){
									//accumulo fino a 1000 transazioni per blocco e poi le processo
									block = functions.filter_by_assignee(tx_for_block,b,db)
									//inizializzo una variabile per segnalare l'uscita dal while
									var exit = 0;
									//TODO: da verificare l'utilità di questo while
									while(exit == 0){
										if(block != false){
											try{
												b.write_block(block,db,function(err){
													exit = 1;
												})
											}
											catch(e){
												console.log('ERR!\n'+e);
											}
										}
									}
									tx_for_block = []
									block = false;
									i = 1;
								}
								i++;
							}
							else{
								callback();
							}
						});
					},
					//filter_by_assignee  -> validate_transaction - create_block
					//write_block
					function(callback){
						//ritorno il blocco da inserire nella catena con al più 1000 transazioni
						block = functions.filter_by_assignee(tx_for_block,b,db);
						if(block != false){
							try{
								b.write_block(block,db,function(err){
									callback();
								})
							}
							catch(e){
								console.log('ERR!\n'+e);
							}
						}
						else{
							throw ('invalid block, problems on the chain..')
						}
					}
					],
					function(err){
						console.log('block completely create');
						db.close();
					});
			});
	}

	this.voting_process = function(block){

			var url = 'mongodb://localhost:27017/Bigchain2';
			MongoClient.connect(url,function(err,db){

				var bigchain = db.collection('bigchain');
				//cursore per i nuovi blocchi della catena per il processo di votazione
				var cur = bigchain.find().sort({"block_number":-1});
				//var block_id;
				var cursor ;

				async.series([
					//get_last_voted_block()
					function(callback){
						//a causa di problemi nel passaggio di parametri, inserisco qui il contenuto della funzione
						cur.each(function(err,doc){
							if(doc != null){
								//if(doc['votes'][0] != undefined && exit != 1){
								for(var i in doc['votes']){
									if(doc['block_number'] != 0 && exit != 1){
										var vote = doc['votes'][i];
										//if(b.pubkey === doc['block']['voters'][0] && doc['votes'][0]['node_pubkey'] === b.pubkey){
										if(vote['node_pubkey'] === b.pubkey){
											last_voted = doc;
											exit = 1;
										}
									}
								}
							}
							else{
								callback();
							}
						})
					},
					//questa è la fine del get_last_voted_block, inserita qui per problemi di sincronia
					function(callback){
						if(last_voted == null){
							bigchain.findOne({'block_number':0},function(err,block){
								last_voted = block;
								callback();
							})
						}
						else{
							callback();
						}
					},
					//is_valid_block();
					function(callback){
						if(last_voted != null){
							//previous_block_number = last_voted['block_number'];
							previous_block_id = last_voted['_id'];

							console.log('new blocks ready to be voted');
							//block_number = previous_block_number+1;
							bigchain.find({'block_number':{$gt:last_voted['block_number']}}).sort({"block.block_number":1}).toArray(
								function(err,docs){
									cursor=docs;
									console.log('waiting for voting process')
									callback();
								});
						}
					},
					//funzione di votazione: 'vote()'
					function(callback){
						//è stato inserito forEachLimit per poter processare singolarmente ogni blocco del cursore
						//che è necessario votare; un 'async.each' avrebbe avviato parallelamente tutti i processi
						//di votazione, causando gravi problemi di sincronizzazione
						async.forEachLimit(cursor,1,function(block,callback2){
							//if(block != null){
							async.series([
								//block validity
								function(callback1){
									b.is_valid_block(block,function(decision){//block deve essere ogni singolo blocco da validare, ottenuto dal cursore
										if(decision === true){
											validity = decision;
										}else{
											validity = false;
											invalid_reason = decision
										}
										callback1();
									});
								},
								//votazione del blocco
								function(callback1){

									vote = b.vote(block,previous_block_id,validity,invalid_reason);
									callback1();
								},
								//update del blocco della catena
								function(callback1){
									//block_id = vote['vote']['voting_for_block'];

									block['votes'].push(vote);
									bigchain.save(block,function(err){
										if(!(err)){
											previous_block_id = block['_id'];
											callback2();
										}
										else{
											console.log(err);
										}
									});
								}
								]
							);
						},
						//check sulla conclusione della votazione
						function(err){
						    // All tasks are done now
						    if (!(err)){
						    	console.log('voting process ended')
								callback();
							}
						});
					}
					],
					//chiusura del database
					function(err){
						console.log('thanks to choose us!');
						db.close();
					}
				);
			});
	}
}
