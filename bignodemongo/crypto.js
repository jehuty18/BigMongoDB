var sha3 = require('js-sha3').sha3_256;
var crypto = require('crypto');
var cc = require('five-bells-condition');
var util = require('./util.js');


var hash_data = exports.hash_data = function(data){
	
	return sha3(data)
};

var get_hash_data = exports.get_hash_data = function(transaction){	

	//if('transaction' in transaction){
	//	tx = transaction['transaction'];
	//}

	for (var i in transaction['fulfillments']){
		var fulfillment = transaction['fulfillments'][i]
		fulfillment['fulfillment'] = null;
	}

	//return crypto.hash_data(serialize(tx))
	return this.hash_data(util.serialize(transaction));
}

var SigningKey = exports.SigningKey = function(privateKey,block_data){
	//conferma una signature con un input
	var message = block_data;

	var ed = new cc.Ed25519();
	ed.sign(new Buffer(message),new Buffer(privateKey)); 
	return ed.signature.toString('hex');
}