var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var consensus = require('./consensus.js');
var util = require('./util.js');
var crypto = require('./crypto.js');
var deffie = require('crypto');
var async = require('async')

//dichiaro la classe come funzione da esportare, in modo da poter essere accessibile ovunque all'interno del pacchetto
var Bigchain = exports.Bigchain = function Bigchain(){

	//this.pubkey = '3d2176ff7da0ba49ad6421dc79d5f493';
	//this.privkey = '5244bf850b572fed863bb8641368faa6';
	this.pubkey = '50fa7ffce192e67bba0ca960fdb92465'
	this.privkey = '637f767add49e03265b45fc62bdf3a50'
	this.federation_nodes = ['3d2176ff7da0ba49ad6421dc79d5f493','50fa7ffce192e67bba0ca960fdb92465','57253cdaa25e3dab419a8d93a5d6f253'];
	//node2pubkey = 50fa7ffce192e67bba0ca960fdb92465
	//node2privkey = 637f767add49e03265b45fc62bdf3a50
	//node3pubkey = 57253cdaa25e3dab419a8d93a5d6f253
	//node3privkey = 4bf2abacde198cbe1b31f7604630f557

	
	this.constructor = function(host,port,db){
		//'constructor()' si occuperà della inizializzazione
		//TODO: PROBABILMENTE SARÀ DA MODIFICARE IN FASE DI REVIEW

		this.host = host;
		this.port = port;
		this.db = db;
	};

	this.create_genesis_block = function(db,callback){
		//funzione asincrona per la creazione del blocco di genesi
		console.log('creating genesis_block..');
		
		async.series([
			function(callback){
				//effettuo un check sui documenti della collection, se ne esistono non può essere effettuata la creazione del genesis
				db.collection('bigchain').count(function(err,count){
					if(count != 0){
						console.log("ERROR!\nGenesis block already exist!");
						process.exit(-1);
					}
					else{
						callback();
					}
				});
			}
		],
			function(err){
				b = new Bigchain();
				b.constructor();
				//inizializzo il messaggio di benvenuto al bignode!
				var payload = {"message": "Hello from BigNode!"};
				//funzione per la creazione di un generica transaction
				var transaction = b.create_transaction([b.pubkey],[b.pubkey],null,'GENESIS',payload);
				//funzione per la validazione di una generica transaction
				var transaction_signed = b.sign_transaction(transaction,b.privkey,b.pubkey);

				//funzione per la creazione di un generico blocco a cui è necessario passare una tx con segnatura
				var block = b.create_block([transaction_signed]);
				block['block_number'] = 0; //genesis ha block_number=0 essendo il primo blocco della catena

				//funzione per l'inserimento del blocco in bigchain
				b.write_block(block,db,function(err){
					callback();
				});
			}
		);
	};
	

	this.create_transaction = function(current_owners, new_owners, input, operation, payload){
		
		return consensus.create_transaction(current_owners, new_owners, input, operation, payload);
	}

	this.sign_transaction = function(transaction,private_keys,public_keys){

		return consensus.sign_transaction(transaction,private_keys,public_keys);
	}

	this.create_block = function(validated_transaction){
		var block = {
			'timestamp': util.timestamp(),
			'transactions':validated_transaction,
			'node_pubkey':this.pubkey,
			//'voters': this.federetions_nodes+this.pubkey
			'voters':[this.federation_nodes]
		}
		
		//serializzando il blocco prevengo alterazioni di informazioni all'oggetto json
		var block_data = util.serialize(block)
		var block_hash = crypto.hash_data(block_data);
		//var block_signature = crypto.SigningKey(this.privkey,block_data);
		var block_signature = crypto.hash_data(block_data).toString('hex');

		var blocks = {
			'_id':block_hash,
			'block':block,
			'signature': block_signature,
			'votes':[]
		}

		return blocks;

	}

	this.write_block = function(block,db,callback){
		//var block_serialized = rapidjson.dumps(block)
		var bigchain = db.collection('bigchain');

		//la scrittura in db prevede due operazioni asincrone per cui è stato necessario utilizzare il modulo async
		async.series([
			function(callback){
				bigchain.count(function(err,count){
					//aggiorno il block_number al numero dei blocchi storati
					block['block_number'] = count;
					callback();
				})
			},
			function(callback){
				bigchain.insert(block,function(err){
					callback();
				})
			}
		],
		function(err){
			//questa callback ritorna il controllo a main.js
			callback();
		})
	}

	this.getParameters = function(){
		//non necessaria, recupera i parametri fondamentali di core.js

		var par = ""+this.host+" "+this.port+" "+this.db+"\n";
		process.stdout.write(par);
	};

	this.is_valid_transaction = function(bigchain,transaction,db){

		if(this.validate_transaction(bigchain,transaction,db) != null){
			return transaction;
		}
		return false;
	}

	this.validate_transaction = function(bigchain,transaction,db){

		return consensus.validate_transaction(bigchain,transaction,db);
	}

	this.get_transaction = function(txid,db){

		var arr_of_tx = []
		var bigchain = db.collection('bigchain');
		var cursor = bigchain.find();
		cursor.each(function(err,block){
			for(var i in block['block']['transactions']){
				transaction = block['block']['transactions'][i]
				if(transaction['_id'] == txid){
					arr_of_tx.push(transaction)
				}
			}
		})
		if(arr_of_tx.length > 0){
			if(arr_of_tx.length != 1){
				throw('Transaction ids should be unique. There is a problem with the chain')
			}
			else{
				return (arr_of_tx[0]);
			}
		}
		else{
			return false;
		}
	}

	/*this.get_spent = function(){
		//inutile al fine di questo caso d'uso
	}*/

	this.write_transaction = function(signed_transaction){
		//per questioni di sincronia è stata sdoppiata

		var assignee = this.pubkey;
		signed_transaction['assignee']=assignee;
		this.write_on_db(signed_transaction);
	}

	this.write_on_db = function(tx){
		var url = 'mongodb://localhost:27017/Bigchain2';
		MongoClient.connect(url,function(err,db){
			var backlog = db.collection('backlog');
			backlog.insert(tx,function(err){	
				db.close();
			})
		})
	}

	this.is_valid_block = function(block,callback){
		//ritorna true se il blocco è valido, altrimenti l'errore lanciato dalla validate di consensus

		try{
			this.validate_block(block);
			return callback(true);
		}
		catch(e){
			return callback(e);
		}
	}

	this.validate_block = function(block){

		//check sulla validità
		consensus.validate_block(block,this.privkey,this.federation_nodes);

		//check sulla validità delle transactions, se non sono valide restano in backlog
		for(var i in block['block']['transactions']){
			transaction = block['block']['transactions'][i];
			if (this.is_valid_transaction(this,transaction)){}
			else{
				this.validate_transaction(this,transaction);
			}
		}
		return block;
	}

	this.vote = function(block,previous_block_id,decision,invalid_reason){
		//creazione dell'elemento vote da inserire nell'array votes

		vote = {
			'voting_for_block': block['_id'],
			'previous_block': previous_block_id,
			'is_block_valid': decision,
			'invalid_reason': invalid_reason,
			'timestamp': util.timestamp()
		}

		var vote_data = util.serialize(vote);
		var signature = crypto.SigningKey(this.privkey,vote_data);

		vote_signed = {
			'node_pubkey': this.pubkey,
			'signature': signature,
			'vote': vote
		}

		return vote_signed;
	}
}