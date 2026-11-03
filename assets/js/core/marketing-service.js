/* Campaign plans and customer acquisition: BUSINESS_RULES.md section 15. */
window.GT.marketing = (function () {
  var GT = window.GT;
  var types = ['promotion','social_media','referral_drive','exhibition','other'];
  var statuses = ['Planned','Running','Finished','Cancelled'];
  function canEditCampaign() { return GT.permissions.can('marketing_campaigns', 'E'); }
  function campaignRows() {
    if (!GT.permissions.can('marketing_campaigns', 'V')) return [];
    return GT.store.all('campaigns').sort(function (a,b) { return b.start_date.localeCompare(a.start_date); });
  }
  function campaign(id) {
    return GT.permissions.can('campaign_details', 'V') ? GT.store.find('campaigns', id) : null;
  }
  function eligibleMessages() {
    if (!GT.permissions.can('marketing_campaigns', 'V')) return [];
    // A-114: no reminder or supplier/payment data is exposed through campaign links.
    return GT.store.all('messages').filter(function (message) {
      var template = GT.store.find('message_templates', message.template_id);
      return message.sent_at && template && ['Promotion','Thank you','Thank-you','New designs','Order ready'].includes(template.name) &&
        ['customer',undefined].includes(message.reference_type);
    });
  }
  function linkedRecords(row) {
    if (!GT.permissions.can('campaign_details', 'V')) return [];
    var messageIds = row.message_ids || [], posterIds = row.poster_ids || [];
    var messages = eligibleMessages().filter(function (message) { return messageIds.includes(message.id); }).map(function (message) {
      var template = GT.store.find('message_templates', message.template_id);
      return { id:'message-' + message.id, kind:'Message', label:template.name + ' · ' + message.recipient_name,
        channel:message.channel, date:String(message.sent_at).slice(0,10) };
    });
    var posters = GT.store.all('posters').filter(function (poster) { return posterIds.includes(poster.id); }).map(function (poster) {
      return { id:'poster-' + poster.id, kind:'Poster', label:poster.title, channel:poster.size_preset, date:String(poster.created_at || '').slice(0,10) };
    });
    return messages.concat(posters);
  }
  function validDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && GT.dates.addDays(value,0) === value;
  }
  function saveCampaign(id, values) {
    if (!canEditCampaign()) throw new Error('Your role cannot change campaigns.');
    var fields = {}, name = String(values.name || '').trim();
    if (!name) fields.name = 'Enter a campaign name.';
    if (!types.includes(values.type)) fields.type = 'Choose a campaign type.';
    if (!String(values.channel || '').trim()) fields.channel = 'Enter a channel.';
    if (!validDate(values.start_date)) fields.start_date = 'Enter a valid start date.';
    if (!validDate(values.end_date) || values.end_date < values.start_date) fields.end_date = 'End date must be on or after the start date.';
    if (!statuses.includes(values.status)) fields.status = 'Choose a status.';
    ['budget','leads_gained','orders_won','sales_value'].forEach(function (field) {
      if (values[field] === null || values[field] === '' || !Number.isSafeInteger(Number(values[field])) || Number(values[field]) < 0) {
        fields[field] = 'Enter a nonnegative whole number.';
      }
    });
    var availableMessages = eligibleMessages().map(function (row) { return row.id; });
    var messageIds = [...new Set((values.message_ids || []).map(Number))];
    var posterIds = [...new Set((values.poster_ids || []).map(Number))];
    if (messageIds.some(function (messageId) { return !availableMessages.includes(messageId); })) fields.message_ids = 'Choose an available marketing message.';
    if (posterIds.some(function (posterId) { return !GT.store.find('posters', posterId); })) fields.poster_ids = 'Choose an existing poster.';
    if (Object.keys(fields).length) { var error = new Error('Please correct the campaign fields.'); error.fields = fields; throw error; }
    var record = { name:name, type:values.type, channel:String(values.channel).trim(), start_date:values.start_date, end_date:values.end_date,
      budget:Number(values.budget), target_audience:String(values.target_audience || '').trim(), status:values.status, notes:String(values.notes || '').trim(),
      leads_gained:Number(values.leads_gained), orders_won:Number(values.orders_won), sales_value:Number(values.sales_value),
      result_notes:String(values.result_notes || '').trim(), message_ids:messageIds, poster_ids:posterIds };
    // A-108: plans and manually reported outcomes never post an expense, voucher, order or cash-book entry.
    return GT.store.transaction(function () {
      var before = id ? GT.store.find('campaigns', id) : null;
      if (id && !before) throw new Error('Campaign not found.');
      var saved = id ? GT.store.update('campaigns', id, record) : GT.store.create('campaigns', Object.assign(record, { created_by:GT.session.currentUser().id }));
      GT.audit.log(id ? 'update' : 'create', 'campaigns', saved.id, before, saved);
      return saved;
    });
  }
  function leadReport(from, to, monthly) {
    if (!GT.permissions.can('lead_source_report', 'V')) throw new Error('Lead source report is restricted.');
    var sources = GT.store.all('lead_sources'), selected = GT.store.where('customers', function (customer) {
      return GT.reports.inRange(String(customer.created_at || '').slice(0,10), from, to);
    });
    var groups = {}, customers = {};
    // A-111: count signup cohorts; invoice values use the same selected date range.
    selected.forEach(function (customer) {
      var source = sources.find(function (row) { return row.id === customer.lead_source_id; });
      var month = String(customer.created_at || '').slice(0,7) || 'Unknown date';
      var key = (monthly ? month + '-' : '') + (source ? source.id : 'none');
      if (!groups[key]) groups[key] = { id:key, month:month, name:source ? source.name : 'No source', customers:0, invoiced:0 };
      groups[key].customers += 1;
      customers[customer.id] = key;
    });
    GT.reports.sales().filter(function (row) {
      return row.kind === 'Invoice' && customers[row.customer_id] && GT.reports.inRange(row.date, from, to);
    }).forEach(function (invoice) { groups[customers[invoice.customer_id]].invoiced += invoice.billed; });
    return Object.values(groups).sort(function (a,b) { return (monthly ? b.month.localeCompare(a.month) : 0) || b.customers - a.customers || a.name.localeCompare(b.name); });
  }
  return { types:types, statuses:statuses, canEditCampaign:canEditCampaign, campaignRows:campaignRows, campaign:campaign,
    eligibleMessages:eligibleMessages, linkedRecords:linkedRecords, saveCampaign:saveCampaign, leadReport:leadReport };
}());
