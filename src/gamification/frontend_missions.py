"""Answer keys for the gamified frontend missions (generated from its mission files).

Kept server-side so submitted answers are graded here, not trusted from the browser.
"""

from __future__ import annotations

from typing import Any


FRONTEND_MISSIONS: dict[int, dict[str, Any]] = {
    1: {
        "name": "The Changing Jamuna",
        "coordinates": [
            89.7,
            24.5
        ],
        "estimatedAreaKm2": 12.5,
        "challenges": [
            {
                "correct_index": 1,
                "n_options": 4,
                "explanation": "Calm water acts as a specular mirror. The radar pulse reflects away at the same angle it arrived, returning no signal to the satellite. This yields near-zero backscatter (< –16 dB), displayed as black."
            },
            {
                "correct_index": 2,
                "n_options": 4,
                "explanation": "VH cross-polarisation captures volumetric scattering that penetrates into vegetation canopy, revealing double-bounce between water surface and stems — the dominant mechanism for detecting flooded forests."
            },
            {
                "correct_index": 1,
                "n_options": 4,
                "explanation": "The double-bounce effect occurs when the radar pulse bounces first off the flat water surface, then off a vertical wall (or vice versa), returning directly back to the sensor — producing very high backscatter displayed as bright white."
            }
        ],
        "peak_new_water_km2": 162.2
    },
    2: {
        "name": "Brahmaputra Surge",
        "coordinates": [
            93.45,
            26.65
        ],
        "estimatedAreaKm2": 38.2,
        "challenges": [
            {
                "correct_index": 0,
                "n_options": 4,
                "explanation": "Smooth water acts like a mirror and sends the radar pulse away from the satellite. In VV, wind can roughen the surface and brighten it, which is why a VV-only threshold failed on windy dates. The cross-polarised VH channel stays dark over water, so it separates water from land more reliably."
            },
            {
                "correct_index": 2,
                "n_options": 4,
                "explanation": "Use the timeline: on 6 July 2024 the Sentinel-1 analysis finds about 185 km² of new water, the peak of the series, with about 383 km² open water in total. By 23 August the water has started to recede. This is an experimental estimate, not a validated flood map."
            },
            {
                "correct_index": 2,
                "n_options": 4,
                "explanation": "Radiometric Terrain Correction (RTC) normalises backscatter for local incidence angle variations caused by topography, preventing mountain slopes from appearing Falsely bright or dark and skewing the flood threshold."
            }
        ],
        "peak_new_water_km2": 184.7
    },
    3: {
        "name": "Amazon Wetland Dynamics",
        "coordinates": [
            -63.22,
            -4.02
        ],
        "estimatedAreaKm2": 185.6,
        "challenges": [
            {
                "correct_index": 1,
                "n_options": 4,
                "explanation": "Optical sensors need sunlight and a clear view. The Amazon is cloudy for much of the year, and dense canopy hides the ground. Sentinel-1 sends its own microwave pulse, which passes through cloud and works at night, so it can still map open water."
            },
            {
                "correct_index": 1,
                "n_options": 4,
                "explanation": "Intense seasonal rainfall (November–May) over the Andes and Amazon headwaters raises river levels by 10–15 m, inundating up to 350,000 km² of várzea (floodplain forest) — a critical habitat and carbon store that satellite radar helps to monitor."
            },
            {
                "correct_index": 1,
                "n_options": 4,
                "explanation": "The double-bounce mechanism: the radar pulse hits the smooth water surface and reflects upward into a tree trunk, then back directly toward the satellite. This coherent two-bounce path produces very high backscatter — a signature of flooded forest. Longer-wavelength L-band radar sees it best; the C-band Sentinel-1 used here penetrates the canopy poorly, so the water mask here maps open water only."
            }
        ],
        "peak_new_water_km2": 254.9
    }
}
