var crypto = require('./crypto.js');
var cc = require('five-bells-condition');
var Bigchain = require('./core.js').Bigchain;

var timestamp = exports.timestamp = function(){
	var now = new Date();
	// Create an array with the current month, day and time
  	var date = [ now.getFullYear(), now.getMonth() + 1, now.getDate() ];
	// Create an array with the current hour, minute and second
  	var time = [ now.getHours(), now.getMinutes(), now.getSeconds() ];
	// Convert hour from military time
  	time[0] = ( time[0] < 12 ) ? time[0] : time[0] - 12;
	// If hour is 0, set it to 12
  	time[0] = time[0] || 12;
	// If seconds and minutes are less than 10, add a zero
  	for ( var i = 1; i < 3; i++ ) {
    	if ( time[i] < 10 ) {
      		time[i] = "0" + time[i];
    	}
  	}
	// Return the formatted string
  	return date.join("/") + " " + time.join(":") + " "// + us_time;
}

var create_tx = exports.create_tx = function(current_owners, new_owners, inputs, operation, payload){
	/*
	REFERENCE:
	{
            "id": "<sha3 hash>",
            "version": "transaction version number",
            "transaction": {
                "fulfillments": [
                        {
                            "current_owners": ["list of <pub-keys>"],
                            "input": {
                                "txid": "<sha3 hash>",
                                "cid": "condition index"
                            },
                            "fulfillment": "fulfillment of condition cid",
                            "fid": "fulfillment index"
                        }
                    ],
                "conditions": [
                        {
                            "new_owners": ["list of <pub-keys>"],
                            "condition": "condition to be met",
                            "cid": "condition index (1-to-1 mapping with fid)"
                        }
                    ],
                "operation": "<string>",
                "timestamp": "<timestamp from client>",
                "data": {
                    "hash": "<SHA3-256 hash hexdigest of payload>",
                    "payload": {
                        "title": "The Winds of Plast",
                        "creator": "Johnathan Plunkett",
                        "IPFS_key": "QmfQ5QAjvg4GtA3wg3adpnDJug8ktA1BxurVqBD8rtgVjP"
                    }
                }
            },
        }
	*/


	if (current_owners == null || current_owners == undefined){
		current_owners = []
	}
	if (current_owners instanceof Array){}
	else{
		var current_owners = [current_owners]
	}

	if (new_owners == null || current_owners == undefined){
		new_owners = []
	};
	if (new_owners instanceof Array){}
	else{
		var new_owners = [new_owners];
	}

	if (inputs instanceof Array){}
	else{
		var inputs = [inputs];
	}

	var data
	if (payload != null && payload != undefined){
		if (payload instanceof Object){
			hash_payload = crypto.hash_data(serialize(payload));
			data = {
				'hash':hash_payload,
				'payload':payload
			}
		}
		else{
			console.log("ERROR!\n'payload' must be Object");
			return
		}
	}

	var fulfillments = [];

	if (inputs != null && inputs != undefined){
		for ( var i=0; i<inputs.length; i++){
			fulfillments.push({
				'current_owners':current_owners,
				'input': inputs[i],
				'fulfillment':null,
				'fid':i
			})
		}
	}
	//ramo create
	else{
		fulfillments.push({
			'current_owners':current_owners,
			'input': null,
			'fulfillment':null,
			'fid':0
		})
	}

	var conditions = [];
	for(var i in fulfillments){
		var fulfillment = fulfillments[i];
		if(new_owners.length > 1){
			var condition = new cc.ThresholdSha256().setThreshold(new_owners.length);
			for(var new_owner in new_owners){
				var subFulfillment = new cc.Ed25519();
				subFulfillment.setPublicKey(new Buffer(new_owner,'hex'));
				condition.addSubfulfillmentUri(subFulfillment);
			}
		}
		//questo dovrebbe essere l'unico ramo che ci interessa
		else if(new_owners.length == 1){
			var condition = new cc.Ed25519();
			//Per evitare di dover riprogettare l'utilizzo della funzione, inserisco manualmente la chiave privata
			var buffer = '5244bf850b572fed863bb8641368faa6'.toString('hex')
			var edPrivateKey = new Buffer(buffer)
			condition.setPublicKey(new Buffer(new_owners[0]))
			condition.sign(new Buffer('Hello World! New CREATE transaction defined!'), edPrivateKey);
		}
		else{
			condition = null;
		}
		if (condition != null) {
			conditions.push({
				'new_owners':new_owners,
				'condition':{
					'details': this.serialize_json(crypto.hash_data(this.serialize(condition))),
					'uri': condition.serializeUri()
				},
				'cid': fulfillments[i]['fid']
			});
		}
	};


	var tx = {
		'fulfillments': fulfillments,
		'conditions': conditions,
		'operation': operation,
		'timestamp': this.timestamp(), 
		'data': data
	}

	//serialize and convert to bytes
	//var tx_hash = crypto.get_hash_data(serialize(tx));
	var tx_hash = crypto.hash_data(this.serialize(tx))

	transaction = {
		'_id': tx_hash,
		'version': 1,
		'transaction': tx
	}
	return transaction

}

var sign_tx = exports.sign_tx = function(transaction,private_keys,public_keys){

	if (private_keys instanceof Array){}
	else{
		private_keys = new Array(private_keys);
	}
	if (public_keys instanceof Array){}
	else{
		public_keys = new Array(public_keys);
	}

	var key_pairs = {};
	for (var i in public_keys){
		//per ogni chiave pubblica passata alla funzione, creo un array associativo con formato JSON
		//associando ad ogni chiave pubblica la relativas chiave privata
		var pk = public_keys[i]

		key_pairs[pk] = private_keys[i];
	}

	var tx = transaction;

	for (var i in tx['transaction']['fulfillments']){
		//definisco la variabile fulfillment per mettermi alla pari del codice python
		var fulfillment = tx['transaction']['fulfillments'][i];
		var fulfillment_message = this.get_fulfillment_message(transaction,fulfillment); 

		var parsed_fulfillment = new cc.Ed25519(fulfillment_message['condition']['condition']['details']);
		

		var parsed_fulfillment_signed = parsed_fulfillment;


		//single current_owner
		if(parsed_fulfillment instanceof cc.Ed25519){
			parsed_fulfillment_signed = this.fulfill_simple_signature_fulfillment (fulfillment,parsed_fulfillment,fulfillment_message,key_pairs);
		}
		//multiple current_owner
		else if(parsed_fulfillment_signed instanceof cc.ThresholdSha256){
			parsed_fulfillment_signed = this.fulfill_threshold_signature_fulfillment(fulfillment,parsed_fulfillment,fulfillment_message,key_pairs);
		}
		
		var signed_fulfillment = parsed_fulfillment_signed.serializeUri();
		fulfillment['fulfillment'] = signed_fulfillment;
	}

	return tx;
};

/*var get_hash_data_x = exports.get_hash_data_x = function(transaction){
	var tx;
	if('transaction' in transaction){
		tx = transaction['transaction'];
	}
	for (var i in tx['fulfillments']){
		var fulfillment = tx['fulfillments'][i];
		fulfillment['fulfillment'] = null;
	}

	//return crypto.hash_data(serialize(tx))
	return crypto.hash_data(tx);
};*/

var serialize = exports.serialize = function(data){
	return JSON.stringify(data);
}

var serialize_json = exports.serialize_json = function(data){

	return JSON.parse(JSON.stringify(data));
}

var get_fulfillment_message = exports.get_fulfillment_message = function(transaction,fulfillment,serialized){

	//data to sign
	var fulfillment_message = {
		'operation': transaction['transaction']['operation'],
		'timestamp': transaction['transaction']['timestamp'],
		'data': transaction['transaction']['data'],
		'version': transaction['version'],
		'id': transaction['_id']
	}

	fulfillment_message['input'] = fulfillment['input'];
	fulfillment_message['condition'] = null;

	//caso transfer
	if (fulfillment['input'] != null){
		//questo caso non dovrebbe essere compreso nel caso d'uso in esame
	}
	else{
		var current_owner = transaction['transaction']['fulfillments'][0]['current_owners'][0];
		var new_fulfill = new cc.Ed25519();
		new_fulfill.setPublicKey(new Buffer(current_owner),'hex');

		var condition = this.serialize(new_fulfill);
		fulfillment_message['condition'] = {'condition': {'details': condition}};
	}
	if(serialized != null && serialized != undefined){
		return this.serialize(fulfillment_message);
	}
	return fulfillment_message;
}

var fulfill_simple_signature_fulfillment = exports.fulfill_simple_signature_fulfillment = function(fulfillment,parsed_fulfillment,fulfillment_message,key_pairs){

	var current_owner = fulfillment['current_owners'][0];

	try{
		parsed_fulfillment.sign(new Buffer(fulfillment_message.toString('hex')),new Buffer(key_pairs[current_owner]));
	}
	catch(e){
		console.log('ERR!\n'+e);
		process.exit(-1);
	}

	//return parsed_fulfillment.signature.toString('hex');
	return parsed_fulfillment;
}

var fulfill_threshold_signature_fulfillment = exports.fulfill_threshold_signature_fulfillment = function(fulfillment,parsed_fulfillment,fulfillment_message,key_pairs){

	return 'ciao';
}

var verify_signature = exports.verify_signature = function(signed_transaction){

	for(var i in signed_transaction){
		var fulfillment = signed_transaction['transaction']['fulfillments'];
		var fulfillment_message = this.get_fulfillment_message(signed_transaction,fulfillment[0]);

		try{
			var parsed_fulfillment = cc.Ed25519.fromUri(fulfillment[0]['fulfillment'])
		}
		catch(e){
			console.log('Error in \'verify_signature()\'\n'+e);
			return false;
		}
		//testare la validate

		/*if(cc.validateFulfillment(this.serialize(fulfillment_message),fulfillment_message['condition'], message)){
			if(parsed_fulfillment.validate(message)){
				return true
			}
			else{
				return false;
			}
		}*/
	}
	return true;

}