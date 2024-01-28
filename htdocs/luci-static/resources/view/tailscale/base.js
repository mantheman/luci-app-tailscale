/* SPDX-License-Identifier: GPL-3.0-only
 *
 * Copyright (C) 2024 asvow
 */

'use strict';
'require form';
'require fs';
'require poll';
'require rpc';
'require uci';
'require view';

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

function getServiceStatus() {
	return L.resolveDefault(callServiceList('tailscale'), {}).then(function (res) {
		var isRunning = false;
		try {
			isRunning = res['tailscale']['instances']['instance1']['running'];
		} catch (e) { }
		return isRunning;
	});
}

function getLoginStatus() {
	return fs.exec("/usr/sbin/tailscale", ["status"]).then(function(res) {
		if (res.stdout.includes("Logged out")) {
			return false;
		} else {
			return true;
		}
	}).catch(function(error) {
		return undefined;
	});
}

function renderStatus(isRunning) {
	var spanTemp = '<em><span style="color:%s"><strong>%s %s</strong></span></em>';
	var renderHTML;
	if (isRunning) {
		renderHTML = String.format(spanTemp, 'green', _('Tailscale'), _('RUNNING'));
	} else {
		renderHTML = String.format(spanTemp, 'red', _('Tailscale'), _('NOT RUNNING'));
	}

	return renderHTML;
}

function renderLogin(isLoggedIn) {
	var spanTemp = '<span style="color:%s">%s</span>';
	var renderHTML;
	if (isLoggedIn === undefined) {
		renderHTML = String.format(spanTemp, 'orange', _('NOT RUNNING'));
	} else if (isLoggedIn) {
		renderHTML = String.format(spanTemp, 'green', _('Logged IN'));
	} else {
		renderHTML = String.format(spanTemp, 'red', _('Logged OUT'));
	}

	return renderHTML;
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('tailscale'),
			getServiceStatus()
		]);
	},

	render: function(data) {
		var m, s, o;
		var isRunning = data[1];

		m = new form.Map('tailscale', _('Tailscale'),
			_('Tailscale is a cross-platform and easy to use virtual LAN.'));

		s = m.section(form.TypedSection);
		s.anonymous = true;
		s.render = function () {
			return E('div', { class: 'cbi-section', id: 'status_bar' }, [
					E('p', { id: 'service_status' }, renderStatus(isRunning))
			]);
		}

		s = m.section(form.NamedSection, 'settings', 'config');

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = o.disabled;
		o.rmempty = false;
		
		o = s.option(form.DummyValue, 'login_status', _('Login Status'));
		o.depends('enabled', '1');
		o.renderWidget = function(section_id, option_id) {
			poll.add(function() {
				return L.resolveDefault(getLoginStatus()).then(function(res) {
					document.getElementById('login_status_div').innerHTML = renderLogin(res);
				});
			});
	
			return E('div', { 'id': 'login_status_div' }, _('Collecting data ...'));
		};

		return m.render();
	}
});
