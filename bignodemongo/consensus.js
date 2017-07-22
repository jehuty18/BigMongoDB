var util = require('./util.js')
var crypto = require('./crypto.js')

var create_transaction = exports.create_transaction = function(current_owners, new_owners, input, operation, payload){
	
	return util.create_tx(current_owners, new_owners, input, operation, payload);
};

var sign_transaction = exports.sign_transaction = function(transaction,private_keys,public_keys){

	return util.sign_tx(transaction,private_keys,public_keys);
}

var validate_transaction = exports.validate_transaction = function(bigchain,transaction,db){

	//If the operation is CREATE the transaction should have no inputs and
	//should be signed by a federation node
	if(transaction['transaction']['operation'] == 'CREATE'){
		if(transaction['transaction']['fulfillments'][0]['input'] != null){
			throw ('A CREATE operation has no inputs');
		}
		if(bigchain.federation_nodes.indexOf(transaction['transaction']['fulfillments'][0]['current_owners'][0]) <= -1){
		
			throw('Only federation nodes can use the operation `CREATE`');
		}
	}
	//tutto l'else il realtà per il caso d'uso non avrebbe senso, in quanto
	//l'unica operazione accettabile è la creazione di blocchi per la catena
	else{
		//check if the input exists, is owned by the current_owner
		if(transaction['transaction']['fulfillments'] == null){
			throw('Transaction contains no fulfillments');
		}
		//check fulfillments
		for(var i in transaction['transaction']['fulfillments']){
			var fulfillment = transaction['transaction']['fulfillments'][i];
			if(fulfillment['input'] == null){
				throw('Only `CREATE` transactions can have null inputs');
			}			
			var tx_input = bigchain.get_transaction(fulfillment['input']['txid'],db);//da implementare
			if(tx_input == false){
				throw('input does not exists in the bigchain');
			}
		}
	}

	//check hash of the transaction
	var calculate_hash = crypto.get_hash_data(JSON.parse(JSON.stringify(transaction['transaction'])));
	if(calculate_hash != transaction['_id']){
		throw('invalid hash');
	}

	//check signature
	if(util.verify_signature(transaction)){} //da implementare
	else{
		throw('invalid signature');
	}

	return transaction;
}

var validate_block = exports.validate_block = function(block,private_key,federation_nodes){

	var calculate_hash = crypto.hash_data(util.serialize(block['block']));
	if(calculate_hash != block['_id']){
		throw('invalid hash');
	}

	if (federation_nodes.indexOf(block['block']['node_pubkey']) <= -1){
		throw('Only one node could create blocks');
	}
	
	//var block_signature = crypto.SigningKey(private_key,util.serialize(block['block']));
	var block_signature = crypto.hash_data(util.serialize(block['block'])).toString('hex');
	if (block_signature != block['signature']){
		throw('invalid block signature');
	}
	return block;
}