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
