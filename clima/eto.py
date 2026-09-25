"""ETo diária FAO-56 Penman-Monteith (Allen et al., 1998) — funções puras.

Unidades: temperaturas °C, UR %, vento m/s a 2 m, Rs MJ/m²/dia, P kPa,
altitude m, latitude em graus decimais (negativa no hemisfério Sul).
"""
import math

SIGMA = 4.903e-9  # Stefan-Boltzmann, MJ K⁻⁴ m⁻² dia⁻¹
GSC = 0.0820      # constante solar, MJ m⁻² min⁻¹
ALBEDO = 0.23


def fator_u2(altura_m):
    """Converte vento medido a `altura_m` para 2 m (FAO-56 eq. 47)."""
    return 4.87 / math.log(67.8 * altura_m - 5.42)


def e_sat(t):
    """Pressão de saturação de vapor (kPa) — eq. 11."""
    return 0.6108 * math.exp(17.27 * t / (t + 237.3))


def altitude_pela_pressao(p_kpa):
    """Inverte a eq. 7 (P = 101,3·((293−0,0065z)/293)^5,26) → z (m)."""
    return 293.0 / 0.0065 * (1 - (p_kpa / 101.3) ** (1 / 5.26))


def radiacao_extraterrestre(lat_graus, dia_ano):
    """Ra (MJ/m²/dia) — eqs. 21-25."""
    phi = math.radians(lat_graus)
    dr = 1 + 0.033 * math.cos(2 * math.pi * dia_ano / 365)
    delta = 0.409 * math.sin(2 * math.pi * dia_ano / 365 - 1.39)
    ws = math.acos(max(-1.0, min(1.0, -math.tan(phi) * math.tan(delta))))
    return (24 * 60 / math.pi) * GSC * dr * (
        ws * math.sin(phi) * math.sin(delta)
        + math.cos(phi) * math.cos(delta) * math.sin(ws)
    )


def eto_diaria(tmax, tmin, urmax, urmin, u2, rs, p_kpa, lat_graus, dia_ano, altitude_m):
    """ETo (mm/dia). Retorna dict com ETo e intermediários."""
    tmed = (tmax + tmin) / 2  # FAO-56 usa a média de Tmax/Tmin
    delta = 4098 * e_sat(tmed) / (tmed + 237.3) ** 2
    gama = 0.665e-3 * p_kpa
    es = (e_sat(tmax) + e_sat(tmin)) / 2
    ea = (e_sat(tmin) * urmax / 100 + e_sat(tmax) * urmin / 100) / 2
    ra = radiacao_extraterrestre(lat_graus, dia_ano)
    rso = (0.75 + 2e-5 * altitude_m) * ra
    rns = (1 - ALBEDO) * rs
    rel = min(rs / rso, 1.0) if rso > 0 else 1.0
    rnl = SIGMA * ((tmax + 273.16) ** 4 + (tmin + 273.16) ** 4) / 2 \
        * (0.34 - 0.14 * math.sqrt(max(ea, 0))) * (1.35 * rel - 0.35)
    rn = rns - rnl
    g = 0.0
    eto = (0.408 * delta * (rn - g) + gama * 900 / (tmed + 273) * u2 * (es - ea)) \
        / (delta + gama * (1 + 0.34 * u2))
    return {
        "ETo": max(eto, 0.0),
        "Ra": ra, "Rso": rso, "Rn": rn, "Rnl": rnl,
        "es": es, "ea": ea, "delta": delta, "gama": gama,
    }
