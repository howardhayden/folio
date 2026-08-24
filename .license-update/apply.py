from __future__ import annotations

import json
import os
import re
import subprocess
import textwrap
from pathlib import Path

ROOT = Path.cwd()
REPO = os.environ['GITHUB_REPOSITORY'].split('/')[-1]
AUTHOR = 'Hayden Howard'
CONTACT = 'howardhayden@tuta.io'
DATE = '2026-08-24'
PRIMARY = 'PolyForm-Noncommercial-1.0.0'
CONTENT = 'CC-BY-NC-SA-4.0'

PLANS = {
    'chorus': {
        'display': 'CHORUS', 'years': '2026',
        'workflows': [
            'the deterministic scenario grammar and coherence gates',
            'the concurrent-night clock, event ledger, propagation model, and reducers',
            'the separation of ground truth, observation, inference, motive, and unresolved questions',
            'fatigue, support, discernment, enactment, consequence, and debrief behavior',
            'save, replay, receipt, disclosure, and scholarly-evidence workflows',
            'the authored model specifications, diagrams, taxonomies, labels, and test contracts',
        ],
        'content': ['README.md', 'docs/**', 'notebooks/**'],
        'media': ['public/**/*.png', 'public/**/*.jpg', 'public/**/*.jpeg', 'public/**/*.webp', 'public/**/*.svg', 'public/**/*.wav', 'public/**/*.mp3', 'public/**/*.ogg'],
    },
    'evenward': {
        'display': 'Evenward', 'years': '2026',
        'workflows': [
            'the notice-direction-practice-observe regulation loop and pathway selection',
            'movement, breathing, sensory, attention, pattern, and care sequences',
            'avatar articulation, movement cadence, contact, secondary motion, and rendering behavior',
            'environment, lighting, atmosphere, accessibility, symptom, and reduced-motion behavior',
            'trainer lifecycle, state transitions, persistence boundaries, and educational presentation',
            'the authored movement catalog, warnings, labels, visual studies, and test contracts',
        ],
        'content': ['README.md', 'docs/**'],
        'media': ['public/**/*.png', 'public/**/*.jpg', 'public/**/*.jpeg', 'public/**/*.webp', 'public/**/*.svg', 'public/**/*.wav', 'public/**/*.mp3', 'public/**/*.ogg'],
    },
    'fogofsea': {
        'display': 'FOG OF SEA', 'years': '2026',
        'workflows': [
            'scenario composition, validation, regeneration, mission framing, and briefing workflows',
            'warfare-area, objective, platform, aircraft, armament, compatibility, and point-allocation logic',
            'turn commitment, deterministic adjudication, uncertainty, scoring, undo, and debrief workflows',
            'Academy sequencing, knowledge checks, strategic comparisons, and field-guide presentation',
            'environment, weather, celestial, ocean, wildlife, audio, camera, and accessibility engines',
            'the authored force families, scenarios, thresholds, taxonomies, labels, and test contracts',
        ],
        'content': ['README.md', 'START-HERE.md', 'ACCESSIBILITY.md', 'DEPLOY-GITHUB-PAGES.md', 'PLAYTEST_PROTOCOL.md', 'RELEASE_QA.md', 'SECURITY.md', 'docs/**', 'notebooks/**'],
        'media': ['public/**/*.png', 'public/**/*.jpg', 'public/**/*.jpeg', 'public/**/*.webp', 'public/**/*.svg', 'public/**/*.wav', 'public/**/*.mp3', 'public/**/*.ogg'],
        'fog': True,
    },
    'folio': {
        'display': 'hah.dev portfolio', 'years': '2024-2026',
        'workflows': [
            'the single-index state routing and progressive-disclosure presentation',
            'the ASCII character state machine, collision map, writing, attention, swat, and recovery behavior',
            'the shelf filtering, ordering, resume-project, skill-stack, and modal presentation workflows',
            'the distinctive film-grain, signal, motion, typography, icon, and visual-identity integration',
        ],
        'reserved': [
            'README.md', 'app/data.ts', 'app/resume/**', 'app/components/AsciiArt.tsx',
            'app/components/asciiCharacter.js', 'app/components/SignalFuzz.tsx',
            'app/globals.css', 'docs/ascii-character.md', 'public/favicon.ico', 'public/favicon.svg',
        ],
    },
    'inkeeping': {
        'display': 'IN KEEPING', 'years': '2026',
        'workflows': [
            'hostile-file intake, bounded parsing, quarantine, comparison, review, and explicit apply',
            'catalog and archival normalization, schema, crosswalk, provenance, and loss-reporting workflows',
            'workspace creation, explicit persistence, revision, audit-link, concurrency, backup, and recovery',
            'operating-register, incident, decision, rollback, continuity, and institutional-handoff workflows',
            'Technical Report, Public Notice, inventory, matrix, ticket, postmortem, and runbook generation',
            'the authored field models, safeguards, labels, diagrams, test fixtures, and traceability contracts',
        ],
        'content': ['README.md', 'CHANGELOG.md', 'CODE_OF_CONDUCT.md', 'CONTRIBUTING.md', 'SECURITY.md', 'SUPPORT.md', 'docs/**'],
        'media': ['public/**/*.png', 'public/**/*.jpg', 'public/**/*.jpeg', 'public/**/*.webp', 'public/**/*.svg'],
        'citation': True,
    },
}

if REPO not in PLANS:
    raise SystemExit(f'unsupported repository: {REPO}')
plan = PLANS[REPO]

def clean(value: str) -> str:
    return textwrap.dedent(value).strip() + '\n'

def bullets(items: list[str]) -> str:
    return '\n'.join(f'- {item}' for item in items)

def write(path: str, value: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(value, encoding='utf-8')

def replace_section(path: Path, heading_pattern: str, section: str, title: str | None = None) -> None:
    text = path.read_text(encoding='utf-8') if path.exists() else f'# {title}\n'
    pattern = re.compile(rf'(?ms)^##\s+(?:{heading_pattern})\s*\n.*?(?=^##\s+|\Z)')
    if pattern.search(text):
        text = pattern.sub(section.rstrip() + '\n', text, count=1)
    else:
        text = text.rstrip() + '\n\n' + section
    path.write_text(text, encoding='utf-8')

portfolio_terms = clean('''
LicenseRef-Hayden-Portfolio-Content

Copyright (c) 2024-2026 Hayden Howard. All rights reserved.

No additional copyright permission is granted for files identified as
LicenseRef-Hayden-Portfolio-Content in LICENSING.md and LICENSE-MAP.json beyond
rights supplied by applicable law and by the hosting platform's terms.

A person may make copies technically necessary to view and evaluate an
unmodified version of the portfolio. No permission is granted to reproduce,
modify, publish, distribute, sublicense, sell, commercially exploit, train on
as a distinct curated asset, or incorporate protected material into another
product, portfolio, template, dataset, model, or service.

Protected material includes, where identified by the license map, personal and
professional biography, resume content, project descriptions, original ASCII
art and character design, custom animation frames, distinctive visual identity,
custom icons, and closely integrated presentation expression.

No rights are granted in names, marks, logos, likeness, privacy or publicity
rights, or endorsement. Permission requires separate written authorization.

THE MATERIAL IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED. TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE COPYRIGHT HOLDER WILL NOT
BE LIABLE FOR CLAIMS, DAMAGES, OR OTHER LIABILITY ARISING FROM THE MATERIAL OR
ITS USE.
''')

has_content = bool(plan.get('content') or plan.get('media'))
content_block = clean(f'''
## Separable original documentation and media — {CONTENT}

Original prose, explanatory diagrams, and non-code figures in the paths listed
in `LICENSE-MAP.json` are licensed under Creative Commons
Attribution-NonCommercial-ShareAlike 4.0 International. Software code,
substantive code excerpts, code-embedded data, and executable definitions in a
mixed file remain under `{PRIMARY}`. Third-party material retains its own terms.
''') if has_content else ''
reserved_block = clean('''
## Portfolio content and identity — rights reserved

The personal, professional, ASCII-character, animation, and distinctive visual
identity files listed in `LICENSE-MAP.json` are governed by
`LicenseRef-Hayden-Portfolio-Content`, not by the repository's software terms.
''') if plan.get('reserved') else ''

licensing = clean(f'''
# Licensing

Copyright (c) {plan['years']} {AUTHOR}.

This repository is **source-available for noncommercial use**. It is not offered
as open-source software because the public software license excludes commercial
purposes.

Apply terms in this order:

1. an explicit notice in a file;
2. a third-party or source-specific notice;
3. this document and `LICENSE-MAP.json`;
4. the default software license.

## Original software — {PRIMARY}

Unless a narrower category below applies, original source code, stylesheets,
configuration, tests, scripts, workers, code-defined schemas, code-embedded
content or data, and generated executable software are licensed under the
PolyForm Noncommercial License 1.0.0. The root `LICENSE` and
`LICENSES/{PRIMARY}.txt` contain the complete terms.

The public license grants no commercial-use permission. See
`COMMERCIAL-LICENSE.md` for the repository policy summary.

## Project-specific workflow implementation

The default software license covers the copyrightable expression and
implementation of:

{bullets(plan['workflows'])}

This identification does not claim exclusive rights over abstract ideas,
methods, systems, facts, or functionality that copyright law does not protect.

## General-purpose coding functions

No function inside a covered file becomes permissively licensed merely because
it could be useful elsewhere. At introduction of this policy, **no original
source file or function is licensed under MIT**.

A future utility may receive a permissive exception only after extraction into
a separate file or package, removal of project-specific workflow expression, an
explicit `SPDX-License-Identifier: MIT` notice, independent tests, and an exact
entry in `LICENSE-MAP.json`. See `PERMISSIVE-EXCEPTIONS.md`.

{content_block}{reserved_block}
## Generated artifacts

Generation does not erase source licenses. Executable bundles remain governed
by the software terms for covered code; embedded documentation, media, fonts,
and third-party components retain their source terms.

## Third-party material

Third-party packages, fonts, algorithms, icons, photographs, audio, datasets,
and other materials are not relicensed. Their own notices control.

## Earlier snapshots

This policy is prospective. It does not withdraw permissions already attached
to earlier copies distributed under MIT or another license. It governs files as
offered from the commit introducing this policy forward, subject to ownership,
file history, and source-specific notices.

## Names and marks

No copyright license grants trademark, likeness, endorsement, or official-status
rights. See `TRADEMARKS.md`.
''')

workflow_boundary = clean(f'''
# Workflow licensing boundary

The repository's default noncommercial software terms apply to the
copyrightable implementation and expression of:

{bullets(plan['workflows'])}

The boundary is based on **task and product workflows**, not on an attempt to
claim every programming technique inside them. A small or general-purpose
function remains under the license of its containing file unless deliberately
extracted and separately licensed.

## No current permissive carve-outs

`LICENSE-MAP.json` contains an empty `permissive_exceptions` list. Function-level
mixed licensing is hard to audit and easy to misread. A reusable utility must
first become a separate, self-contained module with independent tests and an
explicit SPDX notice.

## Legal boundary

Copyright generally protects source expression, authored text, diagrams,
selection and arrangement, and other original expression; it does not by itself
create exclusive ownership of abstract ideas, methods, systems, facts, or
functionality.
''')

commercial = clean(f'''
# Commercial use

The public repository license grants **no commercial-use permission** for
original {plan['display']} software.

A separate written license is needed before using the original software or
protected workflow implementation for internal for-profit use; paid consulting,
implementation, integration, customization, support, hosting, SaaS, or managed
service; incorporation into a commercial product, service, training program, or
operational offering; sale, resale, sublicensing, monetized distribution, or
commercial promotion; or commercial dataset, model, agent, or machine-learning
development or evaluation.

This is a policy summary, not a modification of the PolyForm license and not an
automatic offer of commercial terms. Commercial permission, if offered, must be
in a separate written agreement from {AUTHOR}.

Contact: {CONTACT}
''')

permissive = clean(f'''
# Permissive code exceptions

There are **no current permissive exceptions**. No file, function, snippet, or
directory is assigned MIT by this policy.

A future exception requires extraction into a separate file or package; removal
of project-specific workflows, labels, schemas, content, and data; independent
tests; an explicit `SPDX-License-Identifier: MIT` notice; and an exact entry in
`LICENSE-MAP.json` with retained engineering evidence.

A function embedded in a `{PRIMARY}` file remains under `{PRIMARY}`.
''')

trademarks = clean('''
# Names, marks, and endorsement

The copyright licenses do not grant permission to use project names, logos,
word marks, source-identifying icons, personal name or likeness, or other
source-designating elements in a way that suggests sponsorship, endorsement,
affiliation, or official status.

Accurate nominative reference and license-required attribution remain permitted
to the extent allowed by law. Modified versions should use a distinct name and
identity unless written permission has been obtained. This notice does not claim
that a mark is registered.
''')

rules = []
if plan.get('reserved'):
    rules.append({'paths': plan['reserved'], 'license': 'LicenseRef-Hayden-Portfolio-Content', 'scope': 'personal/professional content, original ASCII character and animation work, and distinctive visual identity'})
if plan.get('content'):
    rules.append({'paths': plan['content'], 'license': CONTENT, 'scope': 'original prose and non-code figures; code, substantive code excerpts, and code-embedded data remain under the default software license'})
if plan.get('media'):
    rules.append({'paths': plan['media'], 'license': CONTENT, 'scope': 'separable original media only; third-party notices and source-identifying marks override'})
rules += [
    {'paths': ['dist/**', 'out/**', 'site/**', 'build/**'], 'license': 'SOURCE-COMPONENT-TERMS', 'scope': 'generated artifact; embedded components retain source terms'},
    {'paths': ['LICENSES/**', 'THIRD_PARTY_LICENSES.txt', 'THIRD_PARTY_NOTICES.md', 'SBOM*.json', 'SBOM*.spdx.json'], 'license': 'SOURCE-SPECIFIC-NOTICES', 'scope': 'license texts, notices, or metadata; underlying components retain their own terms'},
]
mapping = {
    'format': 'howardhayden-license-map-v2', 'audited': DATE,
    'project': plan['display'], 'source_available_not_open_source': True,
    'default_license': PRIMARY, 'commercial_use_granted': False,
    'precedence': ['explicit-file-notice', 'third-party-or-source-specific-notice', 'ordered-rules-below', 'default-license'],
    'rules': rules, 'workflow_scope': plan['workflows'],
    'permissive_exceptions': [],
    'permissive_exception_requirements': {
        'license': 'MIT', 'requires_separate_file_or_package': True,
        'requires_spdx_header': True, 'requires_explicit_map_entry': True,
    },
    'historical_notice': 'Earlier copies retain permissions attached to the license under which those copies were distributed.',
}

extras = []
if has_content:
    extras.append(CONTENT)
if plan.get('reserved'):
    extras.append('LicenseRef-Hayden-Portfolio-Content')
notice = clean(f'''
Required Notice: Copyright (c) {plan['years']} {AUTHOR}.

{plan['display']}
Primary original-software license: {PRIMARY}
Additional original-material terms: {', '.join(extras) if extras else 'none'}
Commercial use is not granted by the public repository license.
No current permissive source-code exceptions are declared.

See LICENSING.md, WORKFLOW-BOUNDARIES.md, LICENSE-MAP.json, and
COMMERCIAL-LICENSE.md. Third-party and source-specific notices take precedence.
No trademark or endorsement rights are granted.
''')

readme_extra = (' Personal, résumé, ASCII-character, animation, and distinctive identity material remains rights-reserved.' if plan.get('reserved') else (f' Separable original documentation and media use **{CONTENT}**.' if has_content else ''))
readme_section = clean(f'''
## Licensing

{plan['display']} is **source-available for noncommercial use** under
**{PRIMARY}**; commercial use requires a separate written license.{readme_extra}
No current source file or function has a permissive commercial-use exception.
See [`LICENSING.md`](LICENSING.md),
[`WORKFLOW-BOUNDARIES.md`](WORKFLOW-BOUNDARIES.md), and
[`LICENSE-MAP.json`](LICENSE-MAP.json) for scope and historical limits.
''')

contributor_section = clean('''
## Licensing of contributions

This source-available repository is not accepting unsolicited code, content,
design, workflow, or data pull requests. Issue reports may be opened without
transferring copyright.

A substantive contribution is accepted only after written terms preserve the
maintainer's ability to license it consistently with the repository, including
under a separate commercial license. Do not submit employer-, client-, school-,
team-, or third-party-owned material without documented authority.

Accepted engineering changes must preserve genuine engineering evidence through:
`issue → constraint → design decision → implementation → failed test → correction → verification`.
''')

polyform = Path('/tmp/howard-license-texts/PolyForm-Noncommercial-1.0.0.txt').read_text(encoding='utf-8').rstrip() + '\n'
cc = Path('/tmp/howard-license-texts/CC-BY-NC-SA-4.0.txt').read_text(encoding='utf-8').rstrip() + '\n'
write('LICENSE', polyform)
write(f'LICENSES/{PRIMARY}.txt', polyform)
if has_content:
    write(f'LICENSES/{CONTENT}.txt', cc)
if plan.get('reserved'):
    write('LICENSES/LicenseRef-Hayden-Portfolio-Content.txt', portfolio_terms)
write('LICENSING.md', licensing)
write('WORKFLOW-BOUNDARIES.md', workflow_boundary)
write('COMMERCIAL-LICENSE.md', commercial)
write('PERMISSIVE-EXCEPTIONS.md', permissive)
write('LICENSE-MAP.json', json.dumps(mapping, indent=2, ensure_ascii=False) + '\n')
write('TRADEMARKS.md', trademarks)
write('NOTICE', notice)
replace_section(ROOT / 'README.md', 'License|Licensing', readme_section)
replace_section(ROOT / 'CONTRIBUTING.md', 'Licensing of contributions', contributor_section, 'Contributing')

package_path = ROOT / 'package.json'
if package_path.exists():
    data = json.loads(package_path.read_text(encoding='utf-8'))
    if 'license' in data:
        data['license'] = PRIMARY
    else:
        rebuilt = {}
        for key, value in data.items():
            rebuilt[key] = value
            if key == 'version':
                rebuilt['license'] = PRIMARY
        data = rebuilt
    package_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

lock_path = ROOT / 'package-lock.json'
if lock_path.exists():
    data = json.loads(lock_path.read_text(encoding='utf-8'))
    data['license'] = PRIMARY
    data.setdefault('packages', {}).setdefault('', {})['license'] = PRIMARY
    lock_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

if plan.get('citation'):
    citation = ROOT / 'CITATION.cff'
    text = citation.read_text(encoding='utf-8')
    text = re.sub(r'(?m)^license:\s*.*$', f'license: {PRIMARY}', text, count=1) if re.search(r'(?m)^license:\s*.*$', text) else text.rstrip() + f'\nlicense: {PRIMARY}\n'
    citation.write_text(text, encoding='utf-8')

if plan.get('fog'):
    subprocess.run(['node', 'scripts/generate-sbom.mjs'], check=True)
    subprocess.run(['node', 'scripts/generate-sbom.mjs', '--check'], check=True)

for obsolete in [
    'LICENSES/AGPL-3.0-or-later.txt', 'LICENSES/MPL-2.0.txt',
    'LICENSES/CC-BY-4.0.txt', 'LICENSES/CC0-1.0.txt', 'LICENSES/MIT.txt',
]:
    (ROOT / obsolete).unlink(missing_ok=True)

assert json.loads((ROOT / 'LICENSE-MAP.json').read_text())['permissive_exceptions'] == []
assert json.loads((ROOT / 'LICENSE-MAP.json').read_text())['commercial_use_granted'] is False
assert json.loads((ROOT / 'package.json').read_text())['license'] == PRIMARY
if lock_path.exists():
    lock = json.loads(lock_path.read_text())
    assert lock['license'] == PRIMARY and lock['packages']['']['license'] == PRIMARY
assert 'source-available for noncommercial use' in (ROOT / 'README.md').read_text()
