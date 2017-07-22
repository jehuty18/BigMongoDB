var filter_by_assignee = exports.filter_by_assignee = function(array_of_transactions,bigchain,db){
	var array_for_block = [];
	var tx_to_delete = [];
	for(var i in array_of_transactions){
		var transaction = array_of_transactions[i];
		//console.log(transaction);
		if (transaction == 'stop'){
			return false
		}
		if(transaction['assignee'] == bigchain.pubkey){
			delete transaction['assignee'];
			var tx = this.validate_transaction(transaction,bigchain,db);
			//piuttosto che creare il blocco all'interno della validate, ogni volta che valido una transazione
			//la ritorno, in modo da poterla aggiungere ad un nuovo array di transazioni da passare al create_block
			//è da valutare poi in un secondo momento il caso in cui ci siano transazioni non valide
			if (tx != false){
				array_for_block.push(tx);
				tx_to_delete.push(tx);
			}
		}
	}
	this.delete_transactions(tx_to_delete,db)
	return this.create_block(array_for_block,bigchain,db);
}

var validate_transaction = exports.validate_transaction = function(transaction,bigchain,db){
	//console.log(transaction);
	if(transaction == 'stop'){
		return 'stop'
	}

	is_valid_transaction = bigchain.is_valid_transaction(bigchain,transaction,db);
	if(is_valid_transaction){
		//this.create_block(is_valid_transaction);
		return transaction;
	}
	return false;
}

var create_block = exports.create_block = function(array_for_block,bigchain,db){
	//visto che per scrivere il blocco è necessario il riferimento al database, che ho nella funzione start del modulo main
	//qui creo il blocco e lo ritorno alla funzione principale

	if(array_for_block != null && array_for_block != undefined){
		return bigchain.create_block(array_for_block);
	}
}

var delete_transactions = exports.delete_transactions = function(tx_to_delete,db){

	var backlog = db.collection('backlog');

	for(var i in tx_to_delete){
		var tx = tx_to_delete[i];

		backlog.remove({'_id':tx['_id']},function(err,result){
			if(err){
				throw(err);
			}
		});
	}
}