var Bigchain = require('./core.js').Bigchain;
var crypto = require('./crypto.js');
var deffie = require('crypto');

var b = new Bigchain();
b.constructor();

var key_pair = deffie.createDiffieHellman(128);
key_gen = key_pair.generateKeys();
var pubkey = key_pair.getPublicKey('hex');
var privkey = key_pair.getPrivateKey('hex');


digital_asset_payload1 = {
	'array':{
		'messaggio' : 'ciao'
	}
		
};

digital_asset_payload2 = {
	'msg' : 'Prima transazione',
	'proprietario' : 'Giuseppe Sannino',
	'eta' : 23
};


tx1 = b.create_transaction(b.pubkey, pubkey, null, 'CREATE', digital_asset_payload2);
//tx2 = b.create_transaction(b.pubkey, pubkey, null, 'CREATE', digital_asset_payload2);

var tx_signed1 = b.sign_transaction(tx1, b.privkey, b.pubkey);
//var tx_signed2 = b.sign_transaction(tx2, b.privkey, b.pubkey);

b.write_transaction(tx_signed1);
//b.write_transaction(tx_signed2);