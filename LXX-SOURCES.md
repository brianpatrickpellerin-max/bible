# Greek Old Testament data

## Greek text and morphology

Rahlfs 1935 Greek Old Testament transcription and word-level analysis by
Seth Kushniryk / Open Scriptorium, CC BY 4.0, derived from the Eliran Wong
digital edition as described by the upstream publisher.

- Current project: https://github.com/OpenScriptorium/lxx-morph
- Downloaded mirror: https://git.sr.ht/~sethkush/lxx-morph
- Pinned revision: `0a23df295de5e5710724c8b6e84edf99e89348aa`
- Source files: `db/seeds/lxx_morph/*.json` (59 final text files only;
  `.auto.json` and pipeline intermediate files are excluded).
- Licence: https://creativecommons.org/licenses/by/4.0/

The upstream states that the underlying Rahlfs 1935 text is public domain.
Morphology includes automated analysis and editorial corrections. This app
preserves the source's confidence and analysis-source fields, accessible by
tapping a word. It does not describe the whole analysis as independently
verified. Surface text, lemma, parsing and part of speech are preserved.

## Dictionary

STEPBible.org / Tyndale House Cambridge, **TBESG — Translators Brief Lexicon
of Extended Strongs for Greek**, CC BY 4.0.

- https://github.com/STEPBible/STEPBible-Data/tree/master/Lexicons
- Exact downloaded input SHA-256 is recorded in `data/lxx/manifest.json`.
- Data downloaded 23 October 2026.

Transformation: HTML formatting is converted to plain text; dictionary
headwords are matched by Unicode normalisation, then accent-insensitive
spelling. Multiple matching dictionary entries are retained together, not
silently disambiguated. No contextual sense selection is claimed. A
dictionary gloss is not an inflected or context-sensitive translation.
Thirteen explicit equivalents between alternate dictionary headword forms
(such as πορεύομαι / πορεύω) are listed in the builder and checked against
TBESG entries; this is not a general rule replacing middle forms by active
forms. A shared dictionary heading is used for a compact on-screen gloss;
the full set of matching glosses remains in the word sheet.
Unmatched words retain their Greek spelling and source lemma and have no
invented gloss. Original dictionary content is not rewritten.

## Verse mapping

Open Scriptorium's `db/seeds/mt_alignment/verse_pairs.jsonl`, at the same
pinned revision, CC BY 4.0. Incorporates **STEPBible TVTMS**, by
STEPBible.org / Tyndale House Cambridge, CC BY 4.0.

- https://github.com/OpenScriptorium/lxx-morph/tree/main/db/seeds/mt_alignment
- https://github.com/STEPBible/STEPBible-Data/tree/master/Versification

The mapping's target uses English/KJV reference numbers. Its methods and
divergent-section flags are retained in each Greek book's data. These are
passage correspondences, not individual word alignments. Greek native
references, including suffixed verse numbers and chapter zero, are kept.

## Coverage and alternate texts

See `data/lxx/coverage.json` and the manifest for counts and unresolved
dictionary entries. All final source files are included. Counts include
alternate texts separately. Joshua A in this source contains variant
passages rather than a complete second Joshua: it is explicitly labelled
that way. No critical apparatus or additional manuscript editions are
claimed. No automatic matching by identical verse numbers is substituted
for a missing mapping.

## Build

```
python scripts/build_lxx.py /path/to/lxx-morph /path/to/TBESG.txt
```

The conversion uses only Python's standard library and needs no paid API.
Output consists of deterministic compressed per-text files, a dictionary,
a reverse passage map, a manifest and a coverage report. Updating sources
requires rebuilding, reviewing changed coverage and checking verse
correspondences. Attribution and changes must remain available downstream.

## Word links and reviewed English glosses

The same pinned Open Scriptorium revision supplies
`db/seeds/mt_alignment/word_links.jsonl.gz` and `eval_300.json`, CC BY 4.0.
The latter is described upstream as a human-reviewed draft with independent
re-annotation and adjudication. It supplies glosses for a small evaluation
sample, not a complete English interlinear. This website has not independently
verified every gloss or link.

Word coordinates are admitted only when the Hebrew word sequence agrees
exactly, after removing pointing, with the website's Hebrew interlinear.
The source coordinate sequence is checked using Open Scriptures Hebrew Bible
(https://github.com/openscriptures/morphhb), including its full-verse WLC to
KJV numbering conversions. WLC text is public domain; OSHB analysis is CC BY 4.0.
The exact Hebrew revision is in `data/lxx-plus/coverage.json`. The app checks
each linked Hebrew spelling again before displaying it.

Statistical links require stability >= 0.9. Stability is reproducibility of
alignment, not a probability of correctness. Convention-rule links retain
their rule labels. In accepted evaluation passages only high-confidence
reviewed links are used. Greek glosses require matching Greek token sequences;
Hebrew glosses are never copied into Greek translation slots. Links may be
many-to-many. Missing links do not prove that a word was omitted.

## Supplemental dictionary and name forms

- STEPBible **TIPNR — Translators Individualised Proper Names with all
  References**, STEPBible.org / Tyndale House Cambridge, CC BY 4.0:
  https://github.com/STEPBible/STEPBible-Data/tree/master/Proper%20Nouns
  Only spelling equivalents are imported; biographical summaries are excluded.
  Greek name spellings are matched directly to TIPNR Greek forms. Hebrew
  alignment alone is not accepted as a Greek name definition because the
  editions may use different names. These are name equivalents, not etymologies.
- **LSJ9 short definitions**, Francisco Riordan (2026), CC BY 4.0:
  https://github.com/ciscoriordan/lsj9
  Based on the public-domain 1940 Liddell–Scott–Jones lexicon. Supplemental
  matches require exact case-sensitive NFC headwords; obvious OCR stubs and
  bare cross-reference definitions are excluded. The display abbreviation is
  shortened; the complete imported definition remains in the word sheet.

Neither source overrides an existing TBESG entry. All downloaded input hashes,
added headword counts and remaining gaps appear in the enrichment coverage
report. Some dictionary entries remain unmatched and are visibly blank.
Data adaptations and this attribution must be retained under CC BY 4.0:
https://creativecommons.org/licenses/by/4.0/

The enrichment builder also lists forty explicit alternate TBESG headword
equivalents, including contracted ὀστοῦν / ὀστέον and σιδηροῦς / σιδήρεος.
These reuse the complete existing TBESG entries and their Strong's identifiers.
The Greek source lemma is retained. This is not a general rule changing middle
verbs to active verbs or selecting a contextual translation.

An explicit list of complete short LSJ definitions also admits entries such
as Κῦρος (Cyrus) and ἀκτίς (ray). Unusable short OCR fragments such as "also"
remain excluded. The coverage report has an immutable versioned filename
so an offline download retains the report matching its dictionary. The
"Unresolved dictionary words" option lists missing matches by occurrence
count and opens their Scripture occurrences; it makes no translation claims.

## English companion edition

**Brenton English Septuagint (1851)**, public domain. Electronic USFM edition
provided by eBible.org: https://ebible.org/bible/details.php?id=eng-Brenton
Archive: https://ebible.org/Scriptures/eng-Brenton_usfm.zip

USFM headings, footnotes and formatting are removed; verse text and native
edition references are retained. The combined Ezra–Nehemiah book is used for
2 Esdras. The Brenton Daniel, Susanna and Bel texts are offered with Theodotion,
not silently substituted for the Old Greek editions. Brenton is explicitly
labelled as a companion: identical references do not certify identical verse
divisions or exact correspondence with Rahlfs. It is not presented as a
contextual, literal or word-by-word translation of the site's Greek tokens.

The English Genesis PDF at bible.in.ua is now imported separately as described
below. The site's designated bulk archives remain unavailable; no automated
bulk scraping was performed.

Rebuild the separately versioned enrichment pack:

```
python scripts/build_lxx_enrichment.py /path/to/lxx-morph /path/to/morphhb /path/to/TIPNR.txt /path/to/lsj9_short_defs.json /path/to/eng-Brenton_usfm.zip /path/to/TBESG.txt
```

## Optional source English interlinear

**Oleksii Vynokurov, Interlinear Bible**, copyright 2002–2026,
https://www.bible.in.ua/. Genesis English PDF:
https://www.bible.in.ua/underl/pdf/ENG/OT/Gen.pdf
Terms: https://www.bible.in.ua/underl/SUPP/use_en.htm

This is a separate attributed non-commercial source, not CC BY data.
The publisher prohibits ML training, fine-tuning and evaluation and reserves
those rights. Those restrictions remain with the imported material. See
`data/lxx-english/LICENSE.md`. The original Greek corpus and dictionaries
retain their own existing licences.

The importer reads individual PDF drawing objects with PyMuPDF. Each English
label must immediately follow its Greek word and be centered below it.
Chapter titles, page numbers and cross-reference lists are excluded. Entire
verses are accepted only when their complete Greek token sequence matches
the pinned website edition after NFC normalization, case folding and
punctuation removal; accents are retained. References, source Greek spelling,
English labels, blank labels, PDF page numbers and input SHA-256 are retained.
Ambiguous pairings and differing Greek verses are excluded and reported.

The optional "Greek with source English" view preserves the author's English
and square brackets. A blank source label falls back to the dictionary and
the view explicitly states that fallback. Missing passages also show a notice.
This checks extraction and Greek correspondence, not the accuracy of every
translation choice. No whole-Bible contextual English coverage is claimed.
The source PDF remains linked on each matching verse and word sheet.
All ordinary text searches now check Hebrew OT, Greek OT and Greek NT,
independently of the reading mode. English searches use supplied contextual
English, not Greek dictionary definitions. Greek OT English coverage remains
limited to the imported matching Genesis passages. Greek spelling, lemma and
Strong's searches continue to use the full Greek corpus. Results identify the
corpus and show the English searched; results from the three corpora are
interleaved so the first page does not hide the smaller result groups.

The requested final target is a complete literal English translation of the
LXX, preserving Greek wording, articles and word order, searchable together
with the Hebrew OT and Greek NT on every search. The current partial imported
translation does not meet that target: its omitted articles, unmatched
passages and remaining books still require translation and review. Dictionary
definitions and the Brenton companion edition must not be silently substituted
and represented as that completed translation. Source-language queries match
the entered language; searching all corpora does not imply automatically
translating a Hebrew or Greek query into the other language.

```
python scripts/build_lxx_pdf_english.py /path/to/Gen.pdf genesis https://www.bible.in.ua/underl/pdf/ENG/OT/Gen.pdf
```
