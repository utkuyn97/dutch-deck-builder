# DutchDeck Anki Templates
# NL→TR and TR→NL card templates for every schema
# SUPABASE_EDGE_URL → replace with your own URL
# CSS: paste the contents of shared.css into the Anki Styling field

---

## TEMPLATE 1 — NL→TR (For all schemas)

### Front Template
```html
<div class="dd-card">
  <div class="dd-front">
    <div class="dd-word">{{Dutch}}</div>
    {{#Schema}}<div class="dd-front-sub">{{Schema}} · {{Level}}</div>{{/Schema}}
  </div>
</div>
```

### Back Template
```html
{{FrontSide}}

<div class="dd-card">

  {{! ── Header ── }}
  <div class="dd-back-header">
    <span class="dd-back-word">{{Dutch}}</span>
    {{#Schema}}<span class="dd-badge dd-badge--schema">{{Schema}}</span>{{/Schema}}
    {{#Level}}<span class="dd-badge dd-badge--level">{{Level}}</span>{{/Level}}
    {{#FrequencyRank}}<span class="dd-badge dd-badge--freq">#{{FrequencyRank}}</span>{{/FrequencyRank}}
  </div>

  {{#IPA}}<div class="dd-ipa">/{{IPA}}/</div>{{/IPA}}

  {{! ── Translation ── }}
  <div class="dd-translation">
    <div class="dd-translation__primary">{{English}}&nbsp;/&nbsp;{{Turkish}}</div>
    {{#UsageNote}}<div class="dd-translation__flag">💡 {{UsageNote}}</div>{{/UsageNote}}
  </div>

  {{! ── NOUN specific ── }}
  {{#Article}}
  <div class="dd-info">
    <div class="dd-info__row">
      <span class="dd-info__label">Artikel</span>
      <span class="dd-info__value dd-info__value--accent">{{Article}} {{Dutch}}</span>
    </div>
    {{#Plural}}
    <div class="dd-info__row">
      <span class="dd-info__label">Meervoud</span>
      <span class="dd-info__value">{{Plural}}</span>
    </div>
    {{/Plural}}
    {{#Diminutive}}
    <div class="dd-info__row">
      <span class="dd-info__label">Verkleinwoord</span>
      <span class="dd-info__value">{{Diminutive}}</span>
    </div>
    {{/Diminutive}}
    {{#DeHetRule}}
    <div class="dd-info__row">
      <span class="dd-info__label">Regel</span>
      <span class="dd-info__value dd-info__value--note">{{DeHetRule}}</span>
    </div>
    {{/DeHetRule}}
  </div>
  {{/Article}}

  {{! ── VERB — Presens table ── }}
  {{#PresensIK}}
  <div class="dd-table-section">
    <div class="dd-table-label">Presens</div>
    <table class="dd-table">
      <tr><td class="dd-table__pronoun">ik</td><td class="dd-table__form">{{PresensIK}}</td></tr>
      <tr><td class="dd-table__pronoun">jij/je</td><td class="dd-table__form">{{PresensJIJ}}</td></tr>
      <tr><td class="dd-table__pronoun">hij/zij/het</td><td class="dd-table__form">{{PresensHIJ}}</td></tr>
      <tr><td class="dd-table__pronoun">wij/we</td><td class="dd-table__form">{{PresensWIJ}}</td></tr>
      <tr><td class="dd-table__pronoun">jullie</td><td class="dd-table__form">{{PresensJULLIE}}</td></tr>
      <tr><td class="dd-table__pronoun">zij/ze</td><td class="dd-table__form">{{PresensZIJ}}</td></tr>
    </table>
  </div>
  {{/PresensIK}}

  {{! ── VERB — OVT (regular: single form) ── }}
  {{#OVT}}
  {{^OVT_IK}}
  <div class="dd-info">
    <div class="dd-info__row">
      <span class="dd-info__label">OVT</span>
      <span class="dd-info__value dd-info__value--accent">{{OVT}}</span>
    </div>
    {{#TRegel}}<div class="dd-info__row"><span class="dd-info__label">t-regel</span><span class="dd-info__value dd-info__value--note">{{TRegel}}</span></div>{{/TRegel}}
  </div>
  {{/OVT_IK}}
  {{/OVT}}

  {{! ── VERB — OVT (irregular: table) ── }}
  {{#OVT_IK}}
  <div class="dd-table-section">
    <div class="dd-table-label">OVT (onregelmatig)</div>
    <table class="dd-table">
      <tr><td class="dd-table__pronoun">ik/jij/hij</td><td class="dd-table__form dd-table__form--highlight">{{OVT_IK}}</td></tr>
      <tr><td class="dd-table__pronoun">wij/jullie/zij</td><td class="dd-table__form">{{OVT_WIJ}}</td></tr>
    </table>
    {{#OvtNote}}<div class="dd-note dd-note--warn" style="margin-top:0.5rem">⚡ {{OvtNote}}</div>{{/OvtNote}}
  </div>
  {{/OVT_IK}}

  {{! ── VERB — Perfectum ── }}
  {{#Perfectum}}
  <div class="dd-info">
    <div class="dd-info__row">
      <span class="dd-info__label">Perfectum</span>
      <span class="dd-info__value dd-info__value--accent">{{AuxVerb}} {{Perfectum}}</span>
    </div>
    {{#GERule}}<div class="dd-info__row"><span class="dd-info__label">Let op</span><span class="dd-info__value dd-info__value--note">{{GERule}}</span></div>{{/GERule}}
  </div>
  {{/Perfectum}}

  {{! ── VERB SEPARABLE — prefix + subordinate clause ── }}
  {{#IsSeparable}}
  <div class="dd-info">
    <div class="dd-info__row">
      <span class="dd-info__label">Prefix</span>
      <span class="dd-info__value dd-info__value--accent">{{Prefix}}—</span>
    </div>
    {{#BijzinExample}}<div class="dd-info__row"><span class="dd-info__label">Bijzin</span><span class="dd-info__value dd-info__value--note">{{BijzinExample}}</span></div>{{/BijzinExample}}
    {{#PerfectumRule}}<div class="dd-info__row"><span class="dd-info__label">ge- regel</span><span class="dd-info__value dd-info__value--note">{{PerfectumRule}}</span></div>{{/PerfectumRule}}
  </div>
  {{/IsSeparable}}

  {{! ── VERB REFLEXIVE ── }}
  {{#IsReflexive}}
  <div class="dd-table-section">
    <div class="dd-table-label">Reflexief</div>
    <table class="dd-table">
      <tr><td class="dd-table__pronoun">ik</td><td class="dd-table__form">{{ReflexiveIK}}</td></tr>
      <tr><td class="dd-table__pronoun">jij/je</td><td class="dd-table__form">{{ReflexiveJIJ}}</td></tr>
      <tr><td class="dd-table__pronoun">hij</td><td class="dd-table__form">{{ReflexiveHIJ}}</td></tr>
      <tr><td class="dd-table__pronoun">wij/we</td><td class="dd-table__form">{{ReflexiveWIJ}}</td></tr>
      <tr><td class="dd-table__pronoun">zij/ze</td><td class="dd-table__form">{{ReflexiveZIJ}}</td></tr>
    </table>
    {{#AlsoNonReflexive}}
    <div class="dd-note dd-note--success" style="margin-top:0.5rem">
      Ook niet-reflexief: {{NonReflexiveMeaning}}
    </div>
    {{/AlsoNonReflexive}}
  </div>
  {{/IsReflexive}}

  {{! ── VERB DUAL — two meanings ── }}
  {{#TurkishA}}
  <div class="dd-info" style="margin-bottom:0.5rem">
    <div class="dd-section-header">a) {{TurkishA}} / {{EnglishA}}</div>
    <div class="dd-info__row">
      <span class="dd-info__label">Type</span>
      <span class="dd-info__value">{{MeaningAType}}</span>
    </div>
    <div class="dd-info__row">
      <span class="dd-info__label">Perfectum</span>
      <span class="dd-info__value dd-info__value--accent">{{MeaningAAuxVerb}} {{MeaningAPerfectum}}</span>
    </div>
    {{#MeaningAExample}}<div class="dd-info__row"><span class="dd-info__label">Vb.</span><span class="dd-info__value dd-info__value--note">{{MeaningAExample}}</span></div>{{/MeaningAExample}}
    <div class="dd-section-header">b) {{TurkishB}} / {{EnglishB}}</div>
    <div class="dd-info__row">
      <span class="dd-info__label">Type</span>
      <span class="dd-info__value">{{MeaningBType}}</span>
    </div>
    <div class="dd-info__row">
      <span class="dd-info__label">Perfectum</span>
      <span class="dd-info__value dd-info__value--accent">{{MeaningBAuxVerb}} {{MeaningBPerfectum}}</span>
    </div>
    {{#MeaningBExample}}<div class="dd-info__row"><span class="dd-info__label">Vb.</span><span class="dd-info__value dd-info__value--note">{{MeaningBExample}}</span></div>{{/MeaningBExample}}
  </div>
  {{/TurkishA}}

  {{! ── ADJECTIVE ── }}
  {{#Comparative}}
  <div class="dd-info">
    <div class="dd-info__row">
      <span class="dd-info__label">Vergrotend</span>
      <span class="dd-info__value dd-info__value--accent">{{Comparative}}</span>
    </div>
    <div class="dd-info__row">
      <span class="dd-info__label">Overtreffend</span>
      <span class="dd-info__value dd-info__value--accent">{{Superlative}}</span>
    </div>
    {{#InflectieRule}}<div class="dd-info__row"><span class="dd-info__label">Inflectie</span><span class="dd-info__value dd-info__value--note">{{InflectieRule}}</span></div>{{/InflectieRule}}
  </div>
  {{/Comparative}}

  {{! ── CONJUNCTION / PREPOSITION ── }}
  {{#WordOrder}}
  <div class="dd-info">
    <div class="dd-info__row">
      <span class="dd-info__label">Woordvolgorde</span>
      <span class="dd-info__value">{{WordOrder}}</span>
    </div>
    {{#WordOrderNote}}<div class="dd-info__row"><span class="dd-info__label">Uitleg</span><span class="dd-info__value dd-info__value--note">{{WordOrderNote}}</span></div>{{/WordOrderNote}}
    {{#ContrastWith}}<div class="dd-info__row"><span class="dd-info__label">Vergelijk</span><span class="dd-info__value dd-info__value--note">{{ContrastWith}}</span></div>{{/ContrastWith}}
  </div>
  {{/WordOrder}}

  {{! ── Example sentence ── }}
  {{#ExampleNL}}
  <div class="dd-example">
    <div class="dd-example__nl">🇳🇱 {{ExampleNL}}</div>
    {{#ExampleTR}}<div class="dd-example__sub">🇹🇷 {{ExampleTR}}</div>{{/ExampleTR}}
    {{#ExampleEN}}<div class="dd-example__sub">🇬🇧 {{ExampleEN}}</div>{{/ExampleEN}}
  </div>
  {{/ExampleNL}}

  {{! ── Audio (iOS: plays after user interaction) ── }}
  {{#AudioURL}}[sound:{{AudioURL}}]{{/AudioURL}}

</div>
```

---

## TEMPLATE 2 — TR→NL (Production + Log)

### Front Template
```html
<div class="dd-card">
  <div class="dd-front">
    <div class="dd-word">{{English}} <span style="opacity:0.5">/</span> {{Turkish}}</div>
    {{#Schema}}<div class="dd-front-sub">{{Schema}} · {{Level}}</div>{{/Schema}}
  </div>
</div>
```

### Back Template
```html
{{FrontSide}}

<div class="dd-card">

  {{! ── Header ── }}
  <div class="dd-back-header">
    <span class="dd-back-word">{{Dutch}}</span>
    {{#Schema}}<span class="dd-badge dd-badge--schema">{{Schema}}</span>{{/Schema}}
    {{#Level}}<span class="dd-badge dd-badge--level">{{Level}}</span>{{/Level}}
  </div>

  {{#IPA}}<div class="dd-ipa">/{{IPA}}/</div>{{/IPA}}

  {{! ── Noun: artikel + plural ── }}
  {{#Article}}
  <div class="dd-info">
    <div class="dd-info__row">
      <span class="dd-info__label">Artikel</span>
      <span class="dd-info__value dd-info__value--accent">{{Article}} {{Dutch}}</span>
    </div>
    {{#Plural}}<div class="dd-info__row"><span class="dd-info__label">Meervoud</span><span class="dd-info__value">{{Plural}}</span></div>{{/Plural}}
  </div>
  {{/Article}}

  {{! ── Verb: perfectum reminder ── }}
  {{#Perfectum}}
  <div class="dd-info">
    <div class="dd-info__row">
      <span class="dd-info__label">Perfectum</span>
      <span class="dd-info__value dd-info__value--accent">{{AuxVerb}} {{Perfectum}}</span>
    </div>
  </div>
  {{/Perfectum}}

  {{! ── Example ── }}
  {{#ExampleNL}}
  <div class="dd-example">
    <div class="dd-example__nl">🇳🇱 {{ExampleNL}}</div>
    {{#ExampleTR}}<div class="dd-example__sub">🇹🇷 {{ExampleTR}}</div>{{/ExampleTR}}
  </div>
  {{/ExampleNL}}

  {{! ── Audio ── }}
  {{#AudioURL}}[sound:{{AudioURL}}]{{/AudioURL}}

  {{! ── LOG PIXEL — writes a log to Supabase when the card back is shown ── }}
  {{! Replace SUPABASE_EDGE_URL with your own URL! ── }}
  <img class="dd-log"
       src="https://SUPABASE_EDGE_URL/functions/v1/log-practice?word={{Dutch}}&level={{Level}}&schema={{Schema}}&date={{today}}"
       onerror="void(0)">

</div>
```

---

## GRAMMAR DECK — Template

### Front Template
```html
<div class="dd-card">
  <div class="dd-front">
    <div style="font-size:0.75rem;color:#8888a0;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.5rem">Gramer</div>
    <div class="dd-word" style="font-size:1.75rem">{{Topic}}</div>
    <div class="dd-front-sub">{{Level}}</div>
  </div>
</div>
```

### Back Template
```html
{{FrontSide}}

<div class="dd-card">
  <div class="dd-back-header">
    <span class="dd-back-word">{{Topic}}</span>
    <span class="dd-badge dd-badge--level">{{Level}}</span>
  </div>

  {{#Explanation}}
  <div class="dd-note">{{Explanation}}</div>
  {{/Explanation}}

  {{#Example1NL}}
  <div class="dd-example">
    <div class="dd-example__nl">🇳🇱 {{Example1NL}}</div>
    {{#Example1TR}}<div class="dd-example__sub">🇹🇷 {{Example1TR}}</div>{{/Example1TR}}
  </div>
  {{/Example1NL}}

  {{#Example2NL}}
  <div class="dd-example">
    <div class="dd-example__nl">🇳🇱 {{Example2NL}}</div>
    {{#Example2TR}}<div class="dd-example__sub">🇹🇷 {{Example2TR}}</div>{{/Example2TR}}
  </div>
  {{/Example2NL}}

  {{#CommonMistake}}
  <div class="dd-note dd-note--warn">❌ Yaygın hata: {{CommonMistake}}</div>
  {{/CommonMistake}}

  {{! ── Log (grammar is logged too) ── }}
  <img class="dd-log"
       src="https://SUPABASE_EDGE_URL/functions/v1/log-practice?word={{Topic}}&level={{Level}}&schema=grammar&date={{today}}"
       onerror="void(0)">
</div>
```

---

## SETUP NOTES

1. Paste the contents of shared.css into Anki → Tools → Manage Note Types → Styling
2. Replace SUPABASE_EDGE_URL with your own project
3. NL→TR card type → copy the Front + Back templates
4. TR→NL card type → copy the Front + Back templates
5. Create a new note type for the grammar deck
6. Use scripts/export-to-anki.cjs to export the cards from Supabase to CSV, then import them into Anki
