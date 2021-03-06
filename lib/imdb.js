/// <reference path='../defs/node.d.ts'/>
"use strict";
var __extends = this.__extends || function (d, b) {
	for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
	function __() {this.constructor = d;}
	__.prototype = b.prototype;
	d.prototype = new __();
};
var http = require('http');
var querystring = require('querystring');

var ApiHost = (function () {
	function ApiHost(hc, path) {
		if (hc) {
			if (typeof (hc) === "object") {
				this.host = hc.host;
				this.path = hc.path;
			}
			else {
				this.host = hc;
				this.path = path;
			}
		}
		else {
			this.host = "";
			this.path = "";
		}
	}
	return ApiHost;
})();

var Episode = (function () {
	function Episode(season, name, number) {
		this.season = season;
		this.name = name;
		this.number = number;
	}
	return Episode;
})();
exports.Episode = Episode;

var Movie = (function () {
	function Movie(obj) {
		for (var attr in obj) {
			if (attr === "Year") {
				this["Year"] = obj[attr];
				if (obj["Year"].match(/\d{4}\-(?:\d{4})/)) {
					this[attr] = parseInt(obj[attr], 10);
				}
			}
			else if (obj.hasOwnProperty(attr)) {
				this[attr] = obj[attr];
			}
		}
	}
	return Movie;
})();
exports.Movie = Movie;

var TVShow = (function (_super) {
	__extends(TVShow, _super);

	function TVShow(object) {
		_super.call(this, object);
		this._episodes = [];
		var years = this["Year"].split("-");
		this.start_year = parseInt(years[0], 10) ? parseInt(years[0], 10) : null;
		this.end_year = parseInt(years[1], 10) ? parseInt(years[1], 10) : null;
	}
	TVShow.prototype.episodes = function (cb) {
		if (typeof (cb) !== "function")
			throw new TypeError("cb must be a function");

		if (this._episodes.length !== 0) {
			return cb(null, this._episodes);
		}

		var tvShow = this;
		var episodeList = "";

		var myPoromenos = new ApiHost(poromenos);
		myPoromenos.path += "?" + querystring.stringify({
			name: tvShow.Title
		});
		myPoromenos.path += "&" + querystring.stringify({
			year: tvShow.start_year
		});

		return http.get(myPoromenos, onResponse).on('error', onError);

		function onResponse(res) {
			return res.on('data', onData).on('error', onError).on('end', onEnd);
		}

		function onData(data) {
			return (episodeList += data.toString('utf8'));
		}

		function onEnd() {
			if (episodeList === "" || episodeList === "null")
				return cb(new Error("could not get episodes"), null);

			var eps = [];
			eps = JSON.parse(episodeList)[tvShow.Title].episodes;

			var episodes = [];
			for (var i = 0; i < eps.length; i++) {
				episodes[i] = new Episode(eps[i].season, eps[i].name, eps[i].number);
			}

			tvShow._episodes = episodes;
			return cb(null, episodes);
		}

		function onError(err) {
			return cb(err, null);
		}
	};
	return TVShow;
})(Movie);
exports.TVShow = TVShow;

var ImdbError = (function () {
	function ImdbError(message, movie) {
		this.message = message;
		this.movie = movie;
		this.name = "imdb api error";
	}
	return ImdbError;
})();
exports.ImdbError = ImdbError;

var omdb = new ApiHost("omdbapi.com", "/");
var poromenos = new ApiHost("imdbapi.poromenos.org", "/js/");

function getReq(req, cb) {
	var responseData = "";

	if (typeof (cb) !== "function")
		throw new TypeError("cb must be a function");

	var myOmdb = new ApiHost(omdb);

	if (req.name) {
		myOmdb.path += "?" + querystring.stringify({
			t: req.name,
			y: req.year || null,
			p: 'full',
			r: 'json'
		});
	}
	else if (req.id) {
		myOmdb.path += "?" + querystring.stringify({
			id: req.id,
			p: 'full',
			r: 'json'
		});
	}

	return http.get(myOmdb, onResponse).on('error', onError);

	function onResponse(res) {
		return res.on('data', onData).on('error', onError).on('end', onEnd);
	}

	function onData(data) {
		responseData += data;
	}

	function onEnd() {
		var responseObject;

		try {
			responseObject = JSON.parse(responseData);
		}
		catch (e) {
			return cb(e, null);
		}

		if (!responseObject.Response && responseObject.hasOwnProperty("Error")) {
			return cb(new ImdbError(responseObject.Error + ": " + (req.name ? req.name : req.id), req), null);
		}

		if (responseObject.Type == 'movie')
			responseObject = new Movie(responseObject);
		else
			responseObject = new TVShow(responseObject);

		return cb(null, responseObject);
	}

	function onError(err) {
		return cb(err, null);
	}
}
exports.getReq = getReq;

function get(name, cb) {
	return exports.getReq({
		id: undefined,
		name: name
	}, cb);
}
exports.get = get;

function getById(id, cb) {
	var intRegex = /^\d+$/;
	if (intRegex.test(id)) {
		// user give us a raw id we need to prepend it with tt
		id = 'tt' + id;
	}

	var imdbRegex = /^tt\d+$/;
	if (!imdbRegex.test(id)) {
		throw new TypeError("id must be a an imdb id (tt12345 or 12345)");
	}

	return exports.getReq({
		id: id,
		name: undefined
	}, cb);
}
exports.getById = getById;
