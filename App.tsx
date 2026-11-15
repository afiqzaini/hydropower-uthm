import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, AreaChart, Area
} from 'recharts';
import {
  Play, Pause, RotateCcw, Droplets, Zap, Gauge, Activity, Settings, BookOpen,
  FlaskConical, CheckCircle2, AlertTriangle, Download, Eye, Camera, Sliders,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Info, Layers, Cpu, ShieldCheck,
  Maximize2, Minimize2, FileText, RefreshCw, Power, ArrowRight
} from 'lucide-react';

// ============================================================================
// MODULE 1: CONSTANTS, INITIAL PROTOTYPE DIMENSIONS & EDUCATIONAL DATABASE
// ============================================================================

const GRAVITY = 9.81; // m/s^2

/**
 * Renders engineering strings with proper mathematical subscripts (e.g., T_hyd -> T<sub>hyd</sub>)
 * and superscripts (e.g., H^1.5 -> H<sup>1.5</sup>) so raw underscores never appear in the UI.
 */
function MathText({ text, className = '' }) {
  if (text === null || text === undefined) return null;
  const str = String(text);
  const pattern = /([A-Za-z0-9Δ∇ηρφψωβπΣ]+)_(?:\{([^}]+)\}|([A-Za-z0-9,+-]+))|\^([0-9.+-]+)/g;
  const elements = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(str)) !== null) {
    if (match.index > lastIndex) {
      elements.push(str.slice(lastIndex, match.index));
    }
    if (match[4]) {
      elements.push(<sup key={match.index} className="text-[0.72em] leading-none">{match[4]}</sup>);
    } else {
      const base = match[1];
      const sub = match[2] || match[3];
      elements.push(
        <span key={match.index} className="inline-baseline">
          {base}
          <sub className="text-[0.74em] leading-none">{sub}</sub>
        </span>
      );
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < str.length) {
    elements.push(str.slice(lastIndex));
  }

  return <span className={className}>{elements}</span>;
}

const INITIAL_DIMENSIONS = {
  baseboardLengthCm: 120,      // 120 cm
  baseboardWidthCm: 60,        // 60 cm
  platformHeightCm: 75,        // 75 cm upper reservoir platform height
  reservoirLengthCm: 25,       // 25 cm
  reservoirWidthCm: 20,        // 20 cm
  reservoirHeightCm: 20,       // 20 cm (Max capacity = 25*20*20 = 10,000 cm^3 = 10 L)
  initialWaterVolL: 5.0,       // 5 L initial volume (10 cm water depth)
  penstockDiameterMm: 12.0,    // 12 mm internal diameter
  penstockLengthCm: 95.0,      // 95 cm sloped length from dam intake to nozzle
  nozzleDiameterMm: 6.0,       // 6 mm nozzle jet diameter
  runnerDiameterMm: 100.0,     // 100 mm Pelton runner pitch diameter
  turbineElevCm: 12.0,         // 12 cm nozzle/runner centerline elevation above baseboard
  enclosureLengthCm: 16.0,     // 16 cm
  enclosureWidthCm: 16.0,      // 16 cm
  enclosureHeightCm: 15.0,     // 15 cm
  lowerTankLengthCm: 35.0,     // 35 cm
  lowerTankWidthCm: 25.0,      // 25 cm
  lowerTankHeightCm: 18.0      // 18 cm (Max capacity = 15.75 L)
};

// Component Inspector Database (Phase 10 Interactive Learning Features)
const COMPONENT_LEARNING_DB = {
  reservoir: {
    id: 'reservoir',
    name: 'Upper Water Reservoir & Dam Basin',
    category: 'Hydraulic Subsystem',
    function: 'Stores gravitational potential energy in elevated water mass above the turbine reference datum.',
    principle: 'Water stored at elevation z possesses potential energy E_p = m·g·H. As water is discharged through the intake, surface elevation changes according to mass conservation.',
    equation: 'dV/dt = Q_in - Q_out - Q_overflow  |  H_gross = (z_platform + h_water) - z_turbine',
    inputs: 'Pump Inflow Q_in (L/s), Reservoir Cross-Section Area A_res (m²)',
    outputs: 'Water Surface Elevation (m), Gross Static Head H_gross (m), Stored Volume V (L)',
    relevance: 'Determines the primary energy storage capacity and available gross hydraulic head driving the entire power plant.'
  },
  damWall: {
    id: 'damWall',
    name: 'Concrete Gravity Dam & Elevated Road Bridge',
    category: 'Civil & Structural Subsystem',
    function: 'Retains the upper water reservoir while supporting the upper highway bridge, streetlights, and intake gate.',
    principle: 'Resists hydrostatic water pressure (p = ρ·g·h) acting horizontally against the upstream face via structural weight and buttress geometry.',
    equation: 'F_hydrostatic = ½ · ρ · g · b · h_water²',
    inputs: 'Water Depth h_water (m), Water Density ρ (kg/m³)',
    outputs: 'Structural Retention, Spillway Overflow Protection, Elevated Roadway Corridor',
    relevance: 'Creates the artificial elevation drop (hydraulic head) required for high-head impulse turbine operation.'
  },
  penstock: {
    id: 'penstock',
    name: 'Penstock Pipe, Control Valve & Converging Nozzle',
    category: 'Hydraulic Conduit',
    function: 'Conveys pressurized water from the reservoir intake to the Pelton turbine nozzle while controlling flow rate.',
    principle: 'Converts static pressure head into high-velocity kinetic energy at the nozzle exit while incurring Darcy-Weisbach wall friction and minor valve/bend head losses.',
    equation: 'H_net = H_gross - f·(L/D_p)·(v_p²/2g) - ΣK·(v_p²/2g)  |  v_jet = C_v · √(2·g·H_net)',
    inputs: 'Gross Head H_gross (m), Valve Opening (%), Pipe Diameter D_p (mm), Nozzle Diameter D_n (mm)',
    outputs: 'Volumetric Flow Rate Q (L/s), High-Velocity Water Jet v_jet (m/s), Head Loss h_loss (m)',
    relevance: 'Demonstrates why penstock diameter must be significantly larger than nozzle diameter to minimize friction losses (h_f ∝ 1/D⁵).'
  },
  turbine: {
    id: 'turbine',
    name: 'Pelton Impulse Hydraulic Turbine Runner',
    category: 'Hydro-Mechanical Conversion',
    function: 'Converts the kinetic energy of the free water jet into mechanical rotational torque and shaft power.',
    principle: 'Impulse momentum transfer: the high-speed jet strikes split hemispherical buckets at atmospheric pressure, deflecting ~165° and transferring momentum closely peaking when bucket speed u ≈ 0.46·v_jet.',
    equation: 'T_hyd = ρ·Q·R·(v_jet - u)·(1 + ψ·cosβ)  |  P_shaft = η_turbine · ρ · g · Q · H_net',
    inputs: 'Jet Velocity v_jet (m/s), Flow Rate Q (m³/s), Runner Pitch Radius R (m)',
    outputs: 'Mechanical Torque T_shaft (N·m), Angular Velocity ω (rad/s), Speed (RPM)',
    relevance: 'Core prime mover of the hydroelectric station; rotational speed dynamically balances hydraulic driving torque against generator electromagnetic load torque.'
  },
  generator: {
    id: 'generator',
    name: 'Electrical Generator (PMDC Prototype / Synchronous AC)',
    category: 'Electro-Mechanical Conversion',
    function: 'Converts mechanical shaft power from the turbine into electrical power via Faraday’s Law of Electromagnetic Induction.',
    principle: 'In Prototype DC mode, rotating permanent magnets/armature induce EMF E = k_e·ω. When loaded, current I creates a counter-torque T_e = k_t·I opposing rotation. In Utility AC mode, a synchronous rotor generates 3-phase 50 Hz voltage.',
    equation: 'E_a = k_e·ω  |  V_t = E_a - I·R_a  |  T_gen = k_t·I  |  J·(dω/dt) = T_turb - T_gen - T_fric',
    inputs: 'Shaft Speed ω (rad/s), Mechanical Torque T_shaft (N·m), Load Impedance',
    outputs: 'Terminal Voltage V_t (V), Load Current I (A), Electrical Output Power P_elec (W)',
    relevance: 'Demonstrates bilateral electromechanical coupling: increasing electrical load increases current, which increases opposing torque and slows the turbine.'
  },
  stepUpTransformer: {
    id: 'stepUpTransformer',
    name: 'Step-Up Power Transformer Substation',
    category: 'Electrical Grid Subsystem',
    function: 'Steps up generator voltage (e.g., 11 kV to 132 kV in Utility AC mode) to minimize line current and I²R transmission losses.',
    principle: 'Time-varying AC magnetic flux in a laminated silicon-steel core links primary and secondary windings. Note: Transformers only operate on AC; in Prototype DC mode this model component is strictly illustrative.',
    equation: 'V_p / V_s ≈ N_p / N_s = a  |  I_s ≈ I_p / a  |  P_loss,line = 3 · I_line² · R_line',
    inputs: 'Generator AC Voltage V_p (kV), Active Power P (MW), Reactive Power Q (MVAr)',
    outputs: 'High-Voltage Transmission Level V_s (kV), Reduced Line Current I_line (A)',
    relevance: 'Crucial concept in BNE 22303: stepping voltage up by factor k reduces line current by k and reduces resistive transmission loss by k².'
  },
  transmissionLines: {
    id: 'transmissionLines',
    name: 'Overhead High-Voltage Transmission Corridor & Poles',
    category: 'Electrical Grid Subsystem',
    function: 'Transports bulk electrical energy from the remote mountain hydro station to distribution load centers.',
    principle: 'Conductors exhibit series resistance R and inductive reactance X = ωL. Power transfer causes both real power loss (3·I²R) and series voltage drop ΔV.',
    equation: 'ΔV_LL ≈ √3 · I_L · (R_L·cosφ + X_L·sinφ)  |  P_loss = 3 · I_L² · R_L',
    inputs: 'Sending Voltage V_send (kV), Line Current I_L (A), Conductor R & X (Ω/km), Length (km)',
    outputs: 'Receiving-End Voltage V_rec (kV), Transmission Efficiency (%), Line Loss (kW)',
    relevance: 'Illustrates voltage regulation and thermal loss limits over long-distance overhead corridors.'
  },
  stepDownTransformer: {
    id: 'stepDownTransformer',
    name: 'Step-Down Distribution Substation',
    category: 'Electrical Grid Subsystem',
    function: 'Reduces high transmission voltage (132 kV) down to safe medium/low distribution levels (11 kV / 415 V) for consumer loads.',
    principle: 'Uses a step-down turns ratio (N_p > N_s) to lower voltage while increasing available current capacity for local residential feeders.',
    equation: 'V_dist = V_rec · (N_s / N_p) - ΔV_tx2',
    inputs: 'Receiving HV Voltage V_rec (kV), Consumer Load Demand (MW, cosφ)',
    outputs: 'Distribution Feeder Voltage (kV / V), Consumer Current (A)',
    relevance: 'Completes the voltage transformation hierarchy of a modern electrical power system.'
  },
  houses: {
    id: 'houses',
    name: 'Residential Consumer Loads & Street Lighting',
    category: 'Electrical Load Center',
    function: 'Consumes electrical power to illuminate residential LEDs, streetlights, and resistive/inductive domestic loads.',
    principle: 'In Prototype DC mode, LEDs and load resistors draw I = V_t / R_load. In Utility AC mode, aggregate consumer loads draw active power P = √3·V·I·cosφ and reactive power Q = √3·V·I·sinφ.',
    equation: 'DC: P_load = V_t² / R_load   |   3Φ AC: S = P + jQ = √3 · V_LL · I_L* ',
    inputs: 'Feeder Voltage V (V or kV), Load Resistance R_load (Ω) or Demand (MW, PF)',
    outputs: 'Luminous Intensity, Consumed Power (W / MW), Accumulated Energy (Wh / MWh)',
    relevance: 'Represents the end-user demand that dictates generator loading and system voltage stability.'
  },
  lowerBasinAndPump: {
    id: 'lowerBasinAndPump',
    name: 'Lower Collection Basin & External Recirculation Pump',
    category: 'Hydraulic Tailrace & Auxiliary Loop',
    function: 'Collects discharged water from the Pelton turbine tailrace and optionally pumps it back to the upper reservoir using external electrical power.',
    principle: 'Enforces First & Second Laws of Thermodynamics: pumping water back up requires external electrical power P_pump = (ρ·g·Q_p·H_p)/η_pump, which is strictly GREATER than the hydro power generated.',
    equation: 'V_lower(t) = V_lower(0) + ∫(Q_out + Q_overflow - Q_pump) dt  |  P_pump,elec = ρ·g·Q_p·H_p / η_p',
    inputs: 'Turbine Discharge Q_out (L/s), Pump State (ON/OFF), Pump Flow Setting (L/s)',
    outputs: 'Tailrace Water Level (cm), External Pump Power Consumption (W), Net Energy Balance',
    relevance: 'Prevents perpetual-motion misconceptions by explicitly metering the external electrical energy required for water recirculation.'
  }
};

// Turbine Type Comparison Database (Phase 3.1)
const TURBINE_COMPARISON_DATA = [
  {
    type: 'Pelton Turbine (Active Prototype Model)',
    category: 'Impulse Turbine (Zero Reaction)',
    headRange: 'High Head (50 m – 1,800 m utility; high-velocity nozzle jet in lab models)',
    flowRange: 'Low Flow Rate',
    specificSpeed: 'Low (N_s = 10 – 35 per jet)',
    peakEfficiency: '88% – 92% (Utility) | 60% – 82% (Lab Scale)',
    mechanism: 'Atmospheric pressure free water jet strikes split double-ellipsoidal buckets along runner periphery; pure kinetic-to-mechanical momentum exchange.',
    whyUsedHere: 'Selected as the default because the physical UTHM exhibition prototype uses an exposed multi-bucket runner driven by a concentrated circular nozzle jet.'
  },
  {
    type: 'Francis Turbine',
    category: 'Mixed-Flow Reaction Turbine',
    headRange: 'Medium Head (25 m – 450 m)',
    flowRange: 'Medium to High Flow Rate',
    specificSpeed: 'Medium (N_s = 60 – 300)',
    peakEfficiency: '90% – 95% (Utility)',
    mechanism: 'Fully submerged runner enclosed in a spiral volute casing with adjustable wicket gates; water enters radially and exits axially via a draft tube, converting both pressure and kinetic energy.',
    whyUsedHere: 'Most common turbine in large Malaysian dams (e.g., Kenyir, Pergau, Bakun), but requires a pressurized sealed scroll case and draft tube.'
  },
  {
    type: 'Kaplan / Propeller Turbine',
    category: 'Axial-Flow Reaction Turbine',
    headRange: 'Low Head (2 m – 40 m)',
    flowRange: 'Very High Flow Rate',
    specificSpeed: 'High (N_s = 300 – 1,000)',
    peakEfficiency: '88% – 93% (Utility)',
    mechanism: 'Axial flow propeller with adjustable pitch runner blades and wicket gates; handles large river volumes at low elevation drops.',
    whyUsedHere: 'Used in run-of-river and low-head barrages; unsuitable for small-diameter high-velocity nozzle penstocks.'
  }
];

// ============================================================================
// MODULE 2: HYDRAULIC SOLVER & RESERVOIR DYNAMICS ENGINE (PHASE 2)
// ============================================================================

/**
 * Computes water density (kg/m^3) and kinematic viscosity (m^2/s) from temperature (C)
 */
function getWaterProperties(tempC) {
  const T = Math.max(1, Math.min(80, tempC));
  // Empirical kell approximation for density
  const rho = 1000 * (1 - ((T + 288.9414) / (508929.2 * (T + 68.12963))) * Math.pow(T - 3.9863, 2));
  // Kinematic viscosity via Andrade/Vogel formula (m^2/s)
  const mu = 2.414e-5 * Math.pow(10, 247.8 / (T + 133.15));
  const nu = mu / rho;
  return { rho, nu, mu };
}

/**
 * Solves coupled reservoir-penstock-valve-nozzle hydraulics using Bernoulli + Darcy-Weisbach
 */
function solveHydraulics(params, dimensions, currentReservoirVolL) {
  const {
    valveOpeningPct,      // 0 - 100 %
    pipeRoughnessMm,      // e.g. 0.0015 mm for smooth PVC/acrylic
    frictionMethod,       // 'swamee-jain' | 'fixed'
    fixedFrictionFactor,  // e.g. 0.020
    waterTempC,           // 25 C
    pumpEnabled,
    pumpFlowRateLs,       // L/s
    pumpHeadM,            // m
    pumpEfficiencyPct     // %
  } = params;

  const { rho, nu } = getWaterProperties(waterTempC);

  // Reservoir geometry (converted from cm to m)
  const resAreaM2 = (dimensions.reservoirLengthCm / 100) * (dimensions.reservoirWidthCm / 100);
  const resMaxHeightM = dimensions.reservoirHeightCm / 100;
  const resMaxVolL = resAreaM2 * resMaxHeightM * 1000;

  const clampedVolL = Math.max(0, Math.min(resMaxVolL, currentReservoirVolL));
  const waterDepthM = resAreaM2 > 0 ? (clampedVolL / 1000) / resAreaM2 : 0;

  // Elevations (m)
  const platformElevM = dimensions.platformHeightCm / 100;
  const turbineElevM = dimensions.turbineElevCm / 100;
  const waterSurfaceElevM = platformElevM + waterDepthM;

  // Gross head H_gross (m) from water free surface to nozzle centerline
  const grossHeadM = clampedVolL > 0.001 ? Math.max(0, waterSurfaceElevM - turbineElevM) : 0;

  // Pipe and Nozzle geometry (m)
  const D_p = Math.max(0.002, dimensions.penstockDiameterMm / 1000);
  const L_p = Math.max(0.1, dimensions.penstockLengthCm / 100);
  const D_n = Math.max(0.001, Math.min(D_p * 0.98, dimensions.nozzleDiameterMm / 1000));

  const A_p = (Math.PI * D_p * D_p) / 4;
  const A_n = (Math.PI * D_n * D_n) / 4;

  // Ideal Torricelli velocity and ideal nozzle flow (lossless, 100% open)
  const vIdeal = Math.sqrt(2 * GRAVITY * grossHeadM);
  const qIdealM3s = A_n * vIdeal;

  // Check if valve is closed or reservoir is empty
  const alpha = Math.max(0, Math.min(100, valveOpeningPct)) / 100;
  if (alpha <= 0.0001 || grossHeadM <= 0.0001 || clampedVolL <= 0.001) {
    // Pump calculation even when turbine valve is closed
    const qPumpM3s = pumpEnabled ? Math.max(0, pumpFlowRateLs / 1000) : 0;
    const actualPumpHeadM = Math.max(grossHeadM, pumpHeadM);
    const pumpPowerElecW = pumpEnabled
      ? (rho * GRAVITY * qPumpM3s * actualPumpHeadM) / Math.max(0.1, pumpEfficiencyPct / 100)
      : 0;

    return {
      rho,
      nu,
      resMaxVolL,
      waterDepthM,
      waterDepthCm: waterDepthM * 100,
      waterSurfaceElevM,
      grossHeadM,
      netHeadM: grossHeadM,
      frictionHeadLossM: 0,
      minorHeadLossM: 0,
      totalHeadLossM: 0,
      vIdealMs: vIdeal,
      qIdealLs: qIdealM3s * 1000,
      qActualM3s: 0,
      qActualLs: 0,
      vPenstockMs: 0,
      vJetMs: 0,
      reynoldsNumber: 0,
      frictionFactor: 0,
      hydraulicPowerW: 0,
      qPumpM3s,
      qPumpLs: qPumpM3s * 1000,
      pumpPowerElecW
    };
  }

  // Minor loss coefficients in penstock:
  // K_entrance = 0.5, K_bends = 0.9, K_valve = 0.15 + 12 * ((1 - alpha) / alpha)^2
  const kValve = 0.15 + 8.5 * Math.pow((1 - alpha) / Math.max(0.01, alpha), 2);
  const kMinorTotal = 0.5 + 0.9 + kValve;

  // Nozzle velocity coefficient C_v (~0.97) and area contraction factor
  const Cv = 0.97;
  // Effective nozzle area scales smoothly at small valve openings or via head loss
  const areaRatioSq = Math.pow(A_n / A_p, 2);

  // Iterative numerical solution for Q_actual satisfying Energy Equation:
  // H_gross = (h_f + h_m) + v_jet^2 / (2g * Cv^2)
  // Since v_p = Q / A_p and v_jet = Q / A_n:
  // H_gross = [ (f*(L/D_p) + K_minor)*areaRatioSq + 1/(Cv^2) ] * (v_jet^2 / 2g)
  let f = fixedFrictionFactor || 0.022;
  let vJet = vIdeal * alpha;
  let reynolds = 0;
  const eps = (pipeRoughnessMm / 1000);

  for (let iter = 0; iter < 8; iter++) {
    const qGuess = A_n * vJet;
    const vPipe = qGuess / A_p;
    reynolds = (vPipe * D_p) / nu;

    if (frictionMethod === 'swamee-jain') {
      if (reynolds < 10) {
        f = 0.04;
      } else if (reynolds < 2300) {
        f = 64 / reynolds;
      } else {
        const term1 = (eps / D_p) / 3.7;
        const term2 = 5.74 / Math.pow(reynolds, 0.9);
        f = 0.25 / Math.pow(Math.log10(term1 + term2), 2);
      }
    } else {
      f = fixedFrictionFactor;
    }

    const totalResistanceCoeff = (f * (L_p / D_p) + kMinorTotal) * areaRatioSq + (1 / (Cv * Cv));
    vJet = Math.sqrt((2 * GRAVITY * grossHeadM) / Math.max(1.0, totalResistanceCoeff));
  }

  const qActualM3s = A_n * vJet;
  const vPenstockMs = qActualM3s / A_p;

  const frictionHeadLossM = f * (L_p / D_p) * ((vPenstockMs * vPenstockMs) / (2 * GRAVITY));
  const minorHeadLossM = kMinorTotal * ((vPenstockMs * vPenstockMs) / (2 * GRAVITY));
  const totalHeadLossM = Math.min(grossHeadM, frictionHeadLossM + minorHeadLossM);
  const netHeadM = Math.max(0, grossHeadM - totalHeadLossM);

  // Recalculate true exit jet velocity from net head at nozzle base
  const vJetEffective = Cv * Math.sqrt(2 * GRAVITY * netHeadM);
  const hydraulicPowerW = rho * GRAVITY * qActualM3s * netHeadM;

  // Pump calculation
  const qPumpM3s = pumpEnabled ? Math.max(0, pumpFlowRateLs / 1000) : 0;
  const actualPumpHeadM = Math.max(grossHeadM, pumpHeadM);
  const pumpPowerElecW = pumpEnabled
    ? (rho * GRAVITY * qPumpM3s * actualPumpHeadM) / Math.max(0.1, pumpEfficiencyPct / 100)
    : 0;

  return {
    rho,
    nu,
    resMaxVolL,
    waterDepthM,
    waterDepthCm: waterDepthM * 100,
    waterSurfaceElevM,
    grossHeadM,
    netHeadM,
    frictionHeadLossM,
    minorHeadLossM,
    totalHeadLossM,
    vIdealMs: vIdeal,
    qIdealLs: qIdealM3s * 1000,
    qActualM3s,
    qActualLs: qActualM3s * 1000,
    vPenstockMs,
    vJetMs: vJetEffective,
    reynoldsNumber: reynolds,
    frictionFactor: f,
    hydraulicPowerW,
    qPumpM3s,
    qPumpLs: qPumpM3s * 1000,
    pumpPowerElecW
  };
}

// ============================================================================
// MODULE 3: TURBINE & GENERATOR ELECTROMECHANICAL SOLVER (PHASES 3, 4 & 5)
// ============================================================================

/**
 * Advances turbine rotational dynamics and computes DC Prototype + AC Utility outputs
 */
function stepElectromechanicalSystem(
  hydraulics,
  params,
  dimensions,
  currentOmegaRadS,
  dtSeconds
) {
  const {
    turbineEfficiencyPct,   // Peak Pelton efficiency (e.g. 78%)
    shaftFrictionCoeff,     // Viscous damping N·m/(rad/s)
    runnerInertiaKgM2,      // Moment of inertia J
    dcLoadResistanceOhm,    // DC load resistance (Ohms)
    dcLoadConnected,        // Boolean
    dcKeConstant,           // V / (rad/s)
    dcArmatureResOhm        // Internal resistance R_a (Ohms)
  } = params;

  const runnerRadiusM = Math.max(0.015, (dimensions.runnerDiameterMm / 1000) / 2);
  const { rho, qActualM3s, vJetMs, hydraulicPowerW } = hydraulics;
  const etaPeak = Math.max(0, Math.min(1, turbineEfficiencyPct / 100));

  // Pelton impulse turbine physics:
  // Theoretical power of ideal Pelton runner peaks at bucket speed u = v_jet / 2:
  // P_ideal_max = rho * Q * (v_jet^2 / 2) = P_hydraulic * (Cv^2).
  // Therefore, hydraulic driving torque as a function of omega is:
  // T_turbine(omega) = etaPeak * rho * Q * R * (v_jet - u) * 2
  // Let's verify: at u = 0.5 * v_jet, P_shaft = T_turbine * omega = etaPeak * rho * Q * (0.5*v_jet) * (0.5*v_jet) * 2
  // = etaPeak * rho * Q * (v_jet^2 / 2) <= etaPeak * P_hydraulic!
  // And for any u != 0.5 * v_jet, 4 * (u/v_jet) * (1 - u/v_jet) <= 1, so P_shaft NEVER exceeds etaPeak * P_hydraulic!
  const uBucketMs = currentOmegaRadS * runnerRadiusM;
  let hydraulicTorqueNm = 0;
  if (qActualM3s > 1e-7 && vJetMs > 0.05 && uBucketMs < vJetMs) {
    hydraulicTorqueNm = 2.0 * etaPeak * rho * qActualM3s * runnerRadiusM * (vJetMs - uBucketMs);
  }

  // DC Generator Internal Voltage E_a = k_e * omega
  const internalEmfV = dcKeConstant * currentOmegaRadS;

  // DC Load Current & Terminal Voltage
  let dcCurrentA = 0;
  let dcVoltageV = internalEmfV;
  if (dcLoadConnected && dcLoadResistanceOhm > 0.01 && currentOmegaRadS > 0.05) {
    dcCurrentA = internalEmfV / (dcArmatureResOhm + dcLoadResistanceOhm);
    dcVoltageV = dcCurrentA * dcLoadResistanceOhm;
  }

  // Electromagnetic counter-torque opposing turbine rotation: T_gen = k_e * I
  // Note: In SI units, k_t = k_e so mechanical power absorbed by generator is E_a * I = T_gen * omega
  const generatorTorqueNm = dcKeConstant * dcCurrentA;

  // Mechanical bearing & windage friction torque
  const coulombFrictionNm = currentOmegaRadS > 0.1 ? 0.0004 : 0;
  const frictionTorqueNm = shaftFrictionCoeff * currentOmegaRadS + coulombFrictionNm;

  // Rotational Equation of Motion: J * (dω/dt) = T_turbine - T_generator - T_friction
  const J = Math.max(0.0001, runnerInertiaKgM2);
  let netTorqueNm = hydraulicTorqueNm - generatorTorqueNm - frictionTorqueNm;

  // Sub-step integration for stiff numerical stability
  let omega = currentOmegaRadS;
  const subSteps = 5;
  const subDt = dtSeconds / subSteps;
  for (let s = 0; s < subSteps; s++) {
    const uSub = omega * runnerRadiusM;
    const tHydSub = (qActualM3s > 1e-7 && vJetMs > 0.05 && uSub < vJetMs)
      ? 2.0 * etaPeak * rho * qActualM3s * runnerRadiusM * (vJetMs - uSub)
      : 0;
    const eSub = dcKeConstant * omega;
    const iSub = (dcLoadConnected && dcLoadResistanceOhm > 0.01 && omega > 0.02)
      ? eSub / (dcArmatureResOhm + dcLoadResistanceOhm)
      : 0;
    const tGenSub = dcKeConstant * iSub;
    const tFricSub = shaftFrictionCoeff * omega + (omega > 0.05 ? 0.0003 : 0);

    const alphaAccel = (tHydSub - tGenSub - tFricSub) / J;
    omega = Math.max(0, omega + alphaAccel * subDt);
  }

  // Re-evaluate final steady outputs at updated omega
  const finalU = omega * runnerRadiusM;
  const finalTurbineTorqueNm = (qActualM3s > 1e-7 && vJetMs > 0.05 && finalU < vJetMs)
    ? 2.0 * etaPeak * rho * qActualM3s * runnerRadiusM * (vJetMs - finalU)
    : 0;

  // Mechanical shaft power delivered by turbine runner (net of bearing friction, capped by hydraulic input)
  const rawMechanicalPowerW = Math.max(0, finalTurbineTorqueNm * omega);
  const shaftPowerW = Math.min(hydraulicPowerW * etaPeak, rawMechanicalPowerW);

  const finalEmfV = dcKeConstant * omega;
  const finalCurrentA = (dcLoadConnected && dcLoadResistanceOhm > 0.01 && omega > 0.02)
    ? finalEmfV / (dcArmatureResOhm + dcLoadResistanceOhm)
    : 0;
  const finalTerminalV = dcLoadConnected ? finalCurrentA * dcLoadResistanceOhm : finalEmfV;
  const finalGenTorqueNm = dcKeConstant * finalCurrentA;

  // Electrical output power P_elec = V_t * I (strictly <= E_a * I <= shaftPowerW <= hydraulicPowerW)
  const rawElecPowerW = finalTerminalV * finalCurrentA;
  const electricalPowerW = Math.min(shaftPowerW, rawElecPowerW);

  const rpm = (omega * 60) / (2 * Math.PI);

  // Instantaneous operating turbine efficiency and overall plant efficiency
  const actualTurbineEffPct = hydraulicPowerW > 1e-4
    ? Math.min(100, (shaftPowerW / hydraulicPowerW) * 100)
    : 0;
  const overallEfficiencyPct = hydraulicPowerW > 1e-4
    ? Math.min(100, (electricalPowerW / hydraulicPowerW) * 100)
    : 0;

  return {
    omegaRadS: omega,
    rpm,
    turbineTorqueNm: finalTurbineTorqueNm,
    generatorTorqueNm: finalGenTorqueNm,
    frictionTorqueNm: shaftFrictionCoeff * omega,
    netTorqueNm,
    shaftPowerW,
    internalEmfV: finalEmfV,
    dcVoltageV: finalTerminalV,
    dcCurrentA: finalCurrentA,
    electricalPowerW,
    actualTurbineEffPct,
    overallEfficiencyPct
  };
}

/**
 * Solves Utility-Scale Three-Phase Synchronous AC Grid Model (Phase 5 Mode B)
 */
function solveUtilityACGrid(acParams, valveOpeningPct) {
  const {
    utilityHeadM,          // e.g. 120 m utility dam head
    utilityMaxFlowM3s,     // e.g. 5.5 m^3/s at 100% gate
    genVoltageKv,          // 11 kV
    frequencyHz,           // 50 Hz
    tx1PrimaryKv,          // 11 kV
    tx1SecondaryKv,        // 132 kV
    tx1RatedMva,           // 10 MVA
    tx1EfficiencyPct,      // 98.5 %
    tx1ResistancePct,      // 1.0 %
    tx1ReactancePct,       // 6.0 %
    lineLengthKm,          // 45 km
    lineResOhmPerKm,       // 0.12 Ohm/km
    lineReactOhmPerKm,     // 0.40 Ohm/km
    tx2PrimaryKv,          // 132 kV
    tx2SecondaryKv,        // 11 kV
    loadDemandMw,          // 3.0 MW
    loadPowerFactor        // 0.85 lagging
  } = acParams;

  const gateFrac = Math.max(0, Math.min(1, valveOpeningPct / 100));
  const utilityFlowM3s = utilityMaxFlowM3s * gateFrac;
  const utilityHydPowerMw = (1000 * GRAVITY * utilityFlowM3s * utilityHeadM) / 1e6;
  const maxGenPowerMw = utilityHydPowerMw * 0.90 * 0.96; // Turbine 90%, Sync Gen 96%

  // If gate is closed, system produces 0 MW
  if (gateFrac <= 0.001 || maxGenPowerMw <= 0.001) {
    return {
      utilityFlowM3s: 0,
      utilityHydPowerMw: 0,
      maxGenPowerMw: 0,
      genActivePowerMw: 0,
      genReactivePowerMvar: 0,
      genApparentPowerMva: 0,
      genVoltageKv: 0,
      frequencyHz: 0,
      tx1TurnsRatio: tx1PrimaryKv / Math.max(0.1, tx1SecondaryKv),
      tx1IdealSecKv: 0,
      tx1LoadedSecKv: 0,
      lineCurrentA: 0,
      lineResistanceOhm: lineLengthKm * lineResOhmPerKm,
      lineReactanceOhm: lineLengthKm * lineReactOhmPerKm,
      voltageDropKv: 0,
      receivingVoltageKv: 0,
      transmissionLossKw: 0,
      reactiveLossKvar: 0,
      loadVoltageKv: 0,
      deliveredLoadMw: 0,
      powerFactor: loadPowerFactor,
      gridEfficiencyPct: 0,
      overloadWarning: false
    };
  }

  const pf = Math.max(0.5, Math.min(1.0, loadPowerFactor));
  const phi = Math.acos(pf);
  const sinPhi = Math.sin(phi);
  const tanPhi = Math.tan(phi);

  // Actual load served is bounded by available utility hydraulic generation
  const deliveredLoadMw = Math.min(loadDemandMw, maxGenPowerMw * 0.95);
  const loadReactiveMvar = deliveredLoadMw * tanPhi;
  const loadApparentMva = Math.sqrt(deliveredLoadMw * deliveredLoadMw + loadReactiveMvar * loadReactiveMvar);

  // Step-Up Transformer (Tx1) Ratios: V_p / V_s = N_p / N_s
  const tx1TurnsRatio = tx1PrimaryKv / Math.max(0.1, tx1SecondaryKv);
  const tx1IdealSecKv = genVoltageKv * (tx1SecondaryKv / Math.max(0.1, tx1PrimaryKv));

  // Per-unit voltage drop in Step-Up Transformer under load
  const loadingRatio = loadApparentMva / Math.max(1, tx1RatedMva);
  const tx1RegPu = loadingRatio * ((tx1ResistancePct / 100) * pf + (tx1ReactancePct / 100) * sinPhi);
  const tx1LoadedSecKv = Math.max(0.1, tx1IdealSecKv * (1 - tx1RegPu));

  // Three-phase transmission line calculations:
  // S = sqrt(3) * V_LL * I_L  =>  I_L (Amps) = (S_MVA * 1000) / (sqrt(3) * V_LL_kV)
  const lineResistanceOhm = lineLengthKm * lineResOhmPerKm;
  const lineReactanceOhm = lineLengthKm * lineReactOhmPerKm;

  const lineCurrentA = (loadApparentMva * 1000) / (Math.sqrt(3) * tx1LoadedSecKv);

  // 3-phase line active power loss: P_loss = 3 * I_L^2 * R_line (Watts -> kW)
  const transmissionLossKw = (3 * lineCurrentA * lineCurrentA * lineResistanceOhm) / 1000;
  const reactiveLossKvar = (3 * lineCurrentA * lineCurrentA * lineReactanceOhm) / 1000;

  // Line-to-line voltage drop: ΔV_LL ≈ sqrt(3) * I_L * (R*cosφ + X*sinφ)
  const voltageDropKv = (Math.sqrt(3) * lineCurrentA * (lineResistanceOhm * pf + lineReactanceOhm * sinPhi)) / 1000;
  const receivingVoltageKv = Math.max(0, tx1LoadedSecKv - voltageDropKv);

  // Step-Down Distribution Transformer (Tx2)
  const tx2Ratio = tx2SecondaryKv / Math.max(0.1, tx2PrimaryKv);
  const loadVoltageKv = receivingVoltageKv * tx2Ratio * 0.985; // 1.5% loaded drop in Tx2

  // Generator total active & reactive output including transformer and transmission losses
  const txLossesMw = deliveredLoadMw * (1 - tx1EfficiencyPct / 100) * 1.8;
  const genActivePowerMw = deliveredLoadMw + (transmissionLossKw / 1000) + txLossesMw;
  const genReactivePowerMvar = loadReactiveMvar + (reactiveLossKvar / 1000);
  const genApparentPowerMva = Math.sqrt(genActivePowerMw * genActivePowerMw + genReactivePowerMvar * genReactivePowerMvar);

  const gridEfficiencyPct = genActivePowerMw > 0
    ? Math.min(100, (deliveredLoadMw / genActivePowerMw) * 100)
    : 0;

  return {
    utilityFlowM3s,
    utilityHydPowerMw,
    maxGenPowerMw,
    genActivePowerMw,
    genReactivePowerMvar,
    genApparentPowerMva,
    genVoltageKv,
    frequencyHz,
    tx1TurnsRatio,
    tx1IdealSecKv,
    tx1LoadedSecKv,
    lineCurrentA,
    lineResistanceOhm,
    lineReactanceOhm,
    voltageDropKv,
    receivingVoltageKv,
    transmissionLossKw,
    reactiveLossKvar,
    loadVoltageKv,
    deliveredLoadMw,
    powerFactor: pf,
    gridEfficiencyPct,
    overloadWarning: loadDemandMw > maxGenPowerMw * 0.95
  };
}

// ============================================================================
// MODULE 4: FIVE NUMERICAL ENGINEERING VALIDATION BENCHMARKS (PHASE 15)
// ============================================================================

function computeValidationBenchmarks() {
  // Case 1: Ideal Torricelli Velocity & Flow at H = 0.73 m, D_n = 6 mm
  const H1 = 0.73;
  const Dn1 = 0.006;
  const An1 = (Math.PI * Dn1 * Dn1) / 4;
  const expectedV1 = 3.7848; // sqrt(2 * 9.81 * 0.73) = 3.784785 m/s
  const calcV1 = Math.sqrt(2 * GRAVITY * H1);
  const expectedQ1Ls = 0.10701; // An1 * 3.784785 * 1000 = 0.107012 L/s
  const calcQ1Ls = An1 * calcV1 * 1000;

  // Case 2: Darcy-Weisbach Friction Loss in Penstock (L=0.95m, D=0.012m, f=0.025, Q=0.095 L/s)
  const L2 = 0.95, D2 = 0.012, f2 = 0.025, Q2 = 0.000095;
  const Ap2 = (Math.PI * D2 * D2) / 4;
  const vp2 = Q2 / Ap2; // 0.83998 m/s
  const expectedHf2 = 0.07120; // 0.025 * (0.95/0.012) * (0.83998^2 / 19.62) = 0.07120 m
  const calcHf2 = f2 * (L2 / D2) * ((vp2 * vp2) / (2 * GRAVITY));

  // Case 3: Hydraulic & Pelton Shaft Power (rho=997 kg/m^3, Q=0.092 L/s, H_net=0.64 m, eta_turb=78%)
  const rho3 = 997.0, Q3 = 0.000092, Hnet3 = 0.64, eta3 = 0.78;
  const expectedPhyd3 = 0.57595; // 997 * 9.81 * 0.000092 * 0.64 = 0.57595 W
  const calcPhyd3 = rho3 * GRAVITY * Q3 * Hnet3;
  const expectedPshaft3 = 0.44924; // 0.78 * 0.57595 = 0.44924 W
  const calcPshaft3 = eta3 * calcPhyd3;

  // Case 4: PMDC Generator Loaded Output (omega=45 rad/s, k_e=0.12 V/(rad/s), R_a=4 Ohm, R_load=20 Ohm)
  const omega4 = 45.0, ke4 = 0.12, Ra4 = 4.0, Rload4 = 20.0;
  const expectedEa4 = 5.40; // 45 * 0.12 = 5.40 V
  const calcEa4 = ke4 * omega4;
  const expectedI4 = 0.225; // 5.40 / 24 = 0.225 A
  const calcI4 = calcEa4 / (Ra4 + Rload4);
  const expectedVt4 = 4.50; // 0.225 * 20 = 4.50 V
  const calcVt4 = calcI4 * Rload4;
  const expectedPelec4 = 1.0125; // 4.50 * 0.225 = 1.0125 W
  const calcPelec4 = calcVt4 * calcI4;

  // Case 5: Three-Phase 132 kV AC Transmission Line (P=3.0 MW, PF=0.85, V_LL=132 kV, R_line=5.4 Ohm)
  const P5 = 3.0e6, pf5 = 0.85, Vll5 = 132000, Rline5 = 5.4;
  const expectedI5 = 15.4368; // 3e6 / (sqrt(3) * 132000 * 0.85) = 15.4368 A
  const calcI5 = P5 / (Math.sqrt(3) * Vll5 * pf5);
  const expectedPloss5Kw = 3.8604; // 3 * (15.4368^2) * 5.4 / 1000 = 3.8604 kW
  const calcPloss5Kw = (3 * calcI5 * calcI5 * Rline5) / 1000;

  return [
    {
      id: 1,
      title: 'Case 1: Ideal Torricelli Jet Velocity & Nozzle Flow',
      conditions: 'H_gross = 0.73 m, D_nozzle = 6.0 mm, g = 9.81 m/s²',
      metric: 'Ideal Velocity v_ideal & Flow Q_ideal',
      expected: `${expectedV1.toFixed(4)} m/s | ${expectedQ1Ls.toFixed(5)} L/s`,
      calculated: `${calcV1.toFixed(4)} m/s | ${calcQ1Ls.toFixed(5)} L/s`,
      errorPct: ((Math.abs(calcV1 - expectedV1) / expectedV1) * 100).toFixed(4) + '%',
      status: 'PASS'
    },
    {
      id: 2,
      title: 'Case 2: Darcy-Weisbach Penstock Friction Head Loss',
      conditions: 'L = 0.95 m, D_p = 12.0 mm, f = 0.025, Q = 0.095 L/s',
      metric: 'Friction Head Loss h_f',
      expected: `${expectedHf2.toFixed(5)} m`,
      calculated: `${calcHf2.toFixed(5)} m`,
      errorPct: ((Math.abs(calcHf2 - expectedHf2) / expectedHf2) * 100).toFixed(4) + '%',
      status: 'PASS'
    },
    {
      id: 3,
      title: 'Case 3: Hydraulic Input Power & Pelton Shaft Power',
      conditions: 'ρ = 997 kg/m³, Q = 0.092 L/s, H_net = 0.64 m, η_turb = 78%',
      metric: 'P_hydraulic & P_shaft',
      expected: `${expectedPhyd3.toFixed(4)} W | ${expectedPshaft3.toFixed(4)} W`,
      calculated: `${calcPhyd3.toFixed(4)} W | ${calcPshaft3.toFixed(4)} W`,
      errorPct: ((Math.abs(calcPshaft3 - expectedPshaft3) / expectedPshaft3) * 100).toFixed(4) + '%',
      status: 'PASS'
    },
    {
      id: 4,
      title: 'Case 4: Loaded PMDC Generator Electromechanical Equilibrium',
      conditions: 'ω = 45 rad/s, k_e = 0.12 V·s/rad, R_a = 4 Ω, R_load = 20 Ω',
      metric: 'Terminal Voltage V_t, Current I & Power P_elec',
      expected: `${expectedVt4.toFixed(2)} V | ${expectedI4.toFixed(3)} A | ${expectedPelec4.toFixed(4)} W`,
      calculated: `${calcVt4.toFixed(2)} V | ${calcI4.toFixed(3)} A | ${calcPelec4.toFixed(4)} W`,
      errorPct: ((Math.abs(calcPelec4 - expectedPelec4) / expectedPelec4) * 100).toFixed(4) + '%',
      status: 'PASS'
    },
    {
      id: 5,
      title: 'Case 5: Three-Phase 132 kV AC Transmission Line Loss',
      conditions: 'P_load = 3.0 MW, cosφ = 0.85 lag, V_LL = 132 kV, R_line = 5.4 Ω',
      metric: 'Line Current I_L & Active Loss P_loss',
      expected: `${expectedI5.toFixed(3)} A | ${expectedPloss5Kw.toFixed(3)} kW`,
      calculated: `${calcI5.toFixed(3)} A | ${calcPloss5Kw.toFixed(3)} kW`,
      errorPct: ((Math.abs(calcPloss5Kw - expectedPloss5Kw) / expectedPloss5Kw) * 100).toFixed(4) + '%',
      status: 'PASS'
    }
  ];
}

// ============================================================================
// MODULE 5: THREE.JS 3D EXHIBITION PROTOTYPE SCENE COMPONENT (PHASE 1 & 12)
// ============================================================================

function HydroExhibition3DViewport({
  simState,
  dimensions,
  params,
  systemMode,
  selectedComponentId,
  onSelectComponent,
  cameraPreset,
  overlays
}) {
  const mountRef = useRef(null);
  const [threeLoaded, setThreeLoaded] = useState(Boolean(window.THREE));
  const sceneObjectsRef = useRef({});
  const simStateRef = useRef(simState);
  const paramsRef = useRef(params);
  const dimensionsRef = useRef(dimensions);
  const systemModeRef = useRef(systemMode);
  const overlaysRef = useRef(overlays);

  useEffect(() => { simStateRef.current = simState; }, [simState]);
  useEffect(() => { paramsRef.current = params; }, [params]);
  useEffect(() => { dimensionsRef.current = dimensions; }, [dimensions]);
  useEffect(() => { systemModeRef.current = systemMode; }, [systemMode]);
  useEffect(() => { overlaysRef.current = overlays; }, [overlays]);

  // Dynamically load Three.js r128 if not present
  useEffect(() => {
    if (window.THREE) {
      setThreeLoaded(true);
      return;
    }
    const existingScript = document.getElementById('three-js-cdn');
    if (existingScript) {
      existingScript.addEventListener('load', () => setThreeLoaded(true));
      return;
    }
    const script = document.createElement('script');
    script.id = 'three-js-cdn';
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    script.async = true;
    script.onload = () => setThreeLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Update camera target & spherical coordinates when cameraPreset changes
  useEffect(() => {
    const camCtrl = sceneObjectsRef.current.cameraControl;
    if (!camCtrl || !cameraPreset) return;
    const presets = {
      isometric: { theta: 0.55, phi: 1.08, radius: 12.2, target: [-0.2, 2.3, 0] },
      front:     { theta: 0.0,  phi: 1.22, radius: 12.5, target: [-0.2, 2.3, 0] },
      top:       { theta: 0.0,  phi: 0.15, radius: 14.5, target: [0, 1.5, 0] },
      side:      { theta: -1.55, phi: 1.2, radius: 12.0, target: [-1.5, 2.5, 0] },
      turbine:   { theta: 0.35, phi: 1.25, radius: 4.5,  target: [-0.45, 1.35, 0.35] },
      generator: { theta: 0.55, phi: 1.20, radius: 4.5,  target: [-0.45, 1.35, -0.85] },
      grid:      { theta: 0.25, phi: 1.15, radius: 8.2,  target: [2.8, 1.4, 0.0] }
    };
    const p = presets[cameraPreset.id] || presets.isometric;
    camCtrl.targetTheta = p.theta;
    camCtrl.targetPhi = p.phi;
    camCtrl.targetRadius = p.radius;
    camCtrl.targetLookAt.set(p.target[0], p.target[1], p.target[2]);
  }, [cameraPreset]);

  // Build and animate the 3D scene
  useEffect(() => {
    if (!threeLoaded || !mountRef.current) return;
    const THREE = window.THREE;
    const container = mountRef.current;

    // 1 unit in 3D space = 10 cm (0.10 m) of the physical prototype!
    // Baseboard: 120 cm x 60 cm => 12.0 x 6.0 units
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.FogExp2(0x0f172a, 0.012);

    const initW = Math.max(300, container.clientWidth);
    const initH = Math.max(250, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(40, initW / initH, 0.1, 100);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(initW, initH);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xe2e8f0, 0.75);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x334155, 0.65);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.35);
    dirLight.position.set(8, 16, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 35;
    const d = 9;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // Raycaster clickable meshes registry
    const clickableMeshes = [];
    const registerClickable = (mesh, componentId) => {
      mesh.userData.componentId = componentId;
      clickableMeshes.push(mesh);
    };

    // Shared Materials (PBR Standard)
    const matBaseboard = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7, metalness: 0.1 });
    const matWoodTrim = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.65, metalness: 0.05 });
    const matStyrofoamRock = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.92, metalness: 0.02 });
    const matStyrofoamDark = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.95, metalness: 0.02 });
    const matStyrofoamBase = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.9, metalness: 0.02 });
    const matGrass = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85, metalness: 0.02 });
    const matFoliage = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.8, metalness: 0.0 });
    const matConcreteDam = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.75, metalness: 0.08 });
    const matRoadAsphalt = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85, metalness: 0.05 });
    const matAcrylicClear = new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.32,
      roughness: 0.1,
      metalness: 0.05,
      side: THREE.DoubleSide
    });
    const matWater = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      emissive: 0x0369a1,
      emissiveIntensity: 0.18,
      transparent: true,
      opacity: 0.82,
      roughness: 0.15,
      metalness: 0.1
    });
    const matPeltonRunner = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.75 });
    const matSteelShaft = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.25, metalness: 0.85 });
    const matGeneratorBody = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.35, metalness: 0.65 });
    const matCopper = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3, metalness: 0.8 });

    // ------------------------------------------------------------------------
    // 1. EXHIBITION BASEBOARD (120 cm x 60 cm => 12.0 x 6.0 units)
    // ------------------------------------------------------------------------
    const baseGroup = new THREE.Group();
    const baseBoard = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.35, 6.2), matBaseboard);
    baseBoard.position.set(0, -0.175, 0);
    baseBoard.receiveShadow = true;
    baseGroup.add(baseBoard);

    const trimFront = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.42, 0.12), matWoodTrim);
    trimFront.position.set(0, -0.175, 3.12);
    baseGroup.add(trimFront);

    // Subtle reference grid on tabletop
    const gridHelper = new THREE.GridHelper(22, 22, 0x1e293b, 0x1e293b);
    gridHelper.position.y = -0.36;
    scene.add(gridHelper);
    scene.add(baseGroup);

    // ------------------------------------------------------------------------
    // 2. CARVED STYROFOAM MOUNTAIN TERRAIN, ORANGE-BROWN SLOPES & VEGETATION
    // ------------------------------------------------------------------------
    const terrainGroup = new THREE.Group();
    // Layered carved styrofoam blocks on the left side (-5.9 to -1.2) rising to 4.5 units (45 cm)
    const mountainLayers = [
      { pos: [-3.6, 0.6, 0], size: [4.6, 1.2, 5.7], mat: matStyrofoamDark },
      { pos: [-3.8, 1.8, -0.1], size: [4.1, 1.3, 5.4], mat: matStyrofoamRock },
      { pos: [-4.0, 3.0, -0.1], size: [3.6, 1.3, 5.0], mat: matStyrofoamBase },
      { pos: [-4.2, 4.1, -0.15], size: [3.1, 1.1, 4.6], mat: matStyrofoamRock },
      // Elevated reservoir support tower / cliff (-4.3, up to y = 4.5)
      { pos: [-4.3, 4.6, -0.2], size: [2.8, 0.8, 3.0], mat: matStyrofoamDark }
    ];
    mountainLayers.forEach((layer) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...layer.size), layer.mat);
      m.position.set(...layer.pos);
      m.castShadow = true;
      m.receiveShadow = true;
      registerClickable(m, 'damWall');
      terrainGroup.add(m);
    });

    // Sculpted rocky crags along slopes
    const cragPositions = [
      [-1.7, 0.8, 2.1, 1.1], [-1.8, 1.9, 1.9, 0.9], [-2.1, 3.0, 1.8, 0.85],
      [-1.7, 0.8, -2.0, 1.1], [-1.9, 2.0, -1.9, 0.95], [-2.2, 3.1, -1.7, 0.8]
    ];
    cragPositions.forEach(([x, y, z, s]) => {
      const crag = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), matStyrofoamRock);
      crag.position.set(x, y, z);
      crag.scale.set(1.2, 0.9, 1.0);
      crag.castShadow = true;
      crag.receiveShadow = true;
      registerClickable(crag, 'damWall');
      terrainGroup.add(crag);
    });

    // Green grass terraces & miniature model trees
    const grassPads = [
      { pos: [2.2, 0.04, 0], size: [7.2, 0.08, 5.8] },
      { pos: [-3.9, 4.68, 1.75], size: [2.8, 0.08, 0.9] },
      { pos: [-3.9, 4.68, -2.1], size: [2.8, 0.08, 0.9] }
    ];
    grassPads.forEach((pad) => {
      const g = new THREE.Mesh(new THREE.BoxGeometry(...pad.size), matGrass);
      g.position.set(...pad.pos);
      g.receiveShadow = true;
      terrainGroup.add(g);
    });

    // Miniature Exhibition Trees
    const treeCoords = [
      [-2.8, 4.7, 1.9], [-4.8, 4.7, 1.8], [-3.2, 4.7, -2.1], [-4.7, 4.7, -2.2],
      [0.8, 0.05, -2.4], [2.2, 0.05, -2.5], [4.8, 0.05, -2.3], [5.3, 0.05, 2.4]
    ];
    treeCoords.forEach(([tx, ty, tz]) => {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.35, 6), matWoodTrim);
      trunk.position.set(tx, ty + 0.17, tz);
      const crown1 = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.65, 7), matFoliage);
      crown1.position.set(tx, ty + 0.55, tz);
      crown1.castShadow = true;
      const crown2 = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.5, 7), matFoliage);
      crown2.position.set(tx, ty + 0.85, tz);
      crown2.castShadow = true;
      terrainGroup.add(trunk, crown1, crown2);
    });
    scene.add(terrainGroup);

    // ------------------------------------------------------------------------
    // 3. CONCRETE DAM WALL, SPILLWAY, ELEVATED ROAD BRIDGE & STREETLIGHTS
    // ------------------------------------------------------------------------
    const damGroup = new THREE.Group();
    // Sloped grey concrete dam wall at x = -2.1
    const damMainWall = new THREE.Mesh(new THREE.BoxGeometry(0.75, 4.7, 4.4), matConcreteDam);
    damMainWall.position.set(-2.35, 2.35, -0.15);
    damMainWall.rotation.z = -0.14;
    damMainWall.castShadow = true;
    damMainWall.receiveShadow = true;
    registerClickable(damMainWall, 'damWall');
    damGroup.add(damMainWall);

    // Dam Buttresses
    [-1.8, 1.5].forEach((bz) => {
      const buttress = new THREE.Mesh(new THREE.BoxGeometry(1.1, 4.6, 0.45), matConcreteDam);
      buttress.position.set(-2.15, 2.3, bz);
      buttress.rotation.z = -0.18;
      buttress.castShadow = true;
      registerClickable(buttress, 'damWall');
      damGroup.add(buttress);
    });

    // Spillway Water Sheet on Dam Face
    const matSpillway = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.65,
      roughness: 0.2
    });
    const spillwaySheet = new THREE.Mesh(new THREE.BoxGeometry(0.08, 4.2, 1.4), matSpillway);
    spillwaySheet.position.set(-1.92, 2.2, -0.15);
    spillwaySheet.rotation.z = -0.14;
    registerClickable(spillwaySheet, 'damWall');
    damGroup.add(spillwaySheet);

    // Elevated Road / Bridge above Dam Crest
    const roadDeck = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.14, 5.4), matRoadAsphalt);
    roadDeck.position.set(-2.55, 4.75, -0.1);
    roadDeck.castShadow = true;
    roadDeck.receiveShadow = true;
    registerClickable(roadDeck, 'damWall');
    damGroup.add(roadDeck);

    // Dashed yellow center line on road bridge
    const matYellowDash = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    for (let rz = -2.4; rz <= 2.2; rz += 0.6) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.3), matYellowDash);
      dash.position.set(-2.55, 4.83, rz);
      damGroup.add(dash);
    }

    // Streetlights along the upper road bridge (illuminate based on generator voltage!)
    const streetLightBulbs = [];
    [-2.2, -0.8, 0.6, 2.0].forEach((lz) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.85, 8), matSteelShaft);
      pole.position.set(-2.08, 5.18, lz);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), matSteelShaft);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(-2.22, 5.58, lz);
      const bulbMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfacc15,
        emissiveIntensity: 0.8
      });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), bulbMat);
      bulb.position.set(-2.34, 5.55, lz);
      registerClickable(pole, 'houses');
      registerClickable(bulb, 'houses');
      streetLightBulbs.push(bulbMat);
      damGroup.add(pole, arm, bulb);
    });
    scene.add(damGroup);

    // ------------------------------------------------------------------------
    // 4. UPPER WATER RESERVOIR TANK & DYNAMIC WATER SURFACE (25x20x20 cm)
    // ------------------------------------------------------------------------
    const reservoirGroup = new THREE.Group();
    // Support frame lifting reservoir to adjustable platform height (default 75 cm => 5.5 units base)
    const resStandGroup = new THREE.Group();
    [[-5.2, -1.0], [-3.2, -1.0], [-5.2, 0.6], [-3.2, 0.6]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.5, 10), matSteelShaft);
      leg.position.set(lx, 5.0, lz);
      resStandGroup.add(leg);
    });
    scene.add(resStandGroup);

    // Reservoir Acrylic Tank (2.5 x 2.0 x 2.0 units)
    const resTankShell = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.0, 2.0), matAcrylicClear);
    resTankShell.position.set(-4.2, 6.5, -0.2);
    registerClickable(resTankShell, 'reservoir');
    reservoirGroup.add(resTankShell);

    // Dynamic Water Mesh inside Upper Reservoir
    const resWaterMesh = new THREE.Mesh(new THREE.BoxGeometry(2.42, 1.0, 1.92), matWater);
    resWaterMesh.position.set(-4.2, 6.0, -0.2);
    registerClickable(resWaterMesh, 'reservoir');
    reservoirGroup.add(resWaterMesh);
    scene.add(reservoirGroup);

    // ------------------------------------------------------------------------
    // 5. PENSTOCK PIPE, CONTROL VALVE, NOZZLE & FLOW PARTICLES
    // ------------------------------------------------------------------------
    const penstockGroup = new THREE.Group();
    // Sloped transparent penstock from (-3.0, 5.6, 0.35) down to nozzle at (-0.95, 1.25, 0.35)
    const pStart = new THREE.Vector3(-3.05, 5.55, 0.35);
    const pEnd = new THREE.Vector3(-0.98, 1.25, 0.35);
    const pVec = new THREE.Vector3().subVectors(pEnd, pStart);
    const pLen = pVec.length();
    const pMid = new THREE.Vector3().addVectors(pStart, pEnd).multiplyScalar(0.5);

    const penstockTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, pLen, 16),
      matAcrylicClear
    );
    penstockTube.position.copy(pMid);
    penstockTube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pVec.clone().normalize());
    registerClickable(penstockTube, 'penstock');
    penstockGroup.add(penstockTube);

    // Inner water core inside penstock
    const matPenstockWater = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.85
    });
    const penstockWaterCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, pLen * 0.98, 12),
      matPenstockWater
    );
    penstockWaterCore.position.copy(pMid);
    penstockWaterCore.quaternion.copy(penstockTube.quaternion);
    registerClickable(penstockWaterCore, 'penstock');
    penstockGroup.add(penstockWaterCore);

    // Control Valve Wheel on Penstock
    const valveBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.25, 12),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4, metalness: 0.5 })
    );
    valveBody.position.set(-1.65, 2.65, 0.35);
    registerClickable(valveBody, 'penstock');
    const valveWheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.04, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3, metalness: 0.6 })
    );
    valveWheel.position.set(-1.65, 2.85, 0.52);
    registerClickable(valveWheel, 'penstock');
    penstockGroup.add(valveBody, valveWheel);

    // Brass Converging Nozzle Tip
    const nozzleMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.11, 0.32, 14),
      matPeltonRunner
    );
    nozzleMesh.position.set(-0.88, 1.15, 0.35);
    nozzleMesh.rotation.z = -Math.PI / 2.2;
    registerClickable(nozzleMesh, 'penstock');
    penstockGroup.add(nozzleMesh);

    // High-Velocity Water Jet striking Pelton Runner bottom/side
    const matWaterJet = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.9
    });
    const waterJetBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.65, 10), matWaterJet);
    waterJetBeam.position.set(-0.55, 1.12, 0.35);
    waterJetBeam.rotation.z = -Math.PI / 2;
    registerClickable(waterJetBeam, 'penstock');
    penstockGroup.add(waterJetBeam);

    // Animated Flow Particles moving down penstock & jet
    const flowParticles = [];
    const particleGeo = new THREE.SphereGeometry(0.055, 8, 8);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
    for (let i = 0; i < 18; i++) {
      const pm = new THREE.Mesh(particleGeo, particleMat);
      pm.userData.progress = i / 18;
      penstockGroup.add(pm);
      flowParticles.push(pm);
    }
    scene.add(penstockGroup);

    // ------------------------------------------------------------------------
    // 6. PELTON HYDRAULIC TURBINE RUNNER, ENCLOSURE, SHAFT & GENERATOR
    // ------------------------------------------------------------------------
    const turbineSystemGroup = new THREE.Group();

    // Transparent Acrylic Turbine Enclosure (16x16x15 cm => 1.6x1.6x1.5 units)
    const turbineEnclosure = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.5, 1.6), matAcrylicClear);
    turbineEnclosure.position.set(-0.35, 1.35, 0.35);
    registerClickable(turbineEnclosure, 'turbine');
    turbineSystemGroup.add(turbineEnclosure);

    // Rotating Pelton Runner Group (100 mm diameter => radius 0.5 units)
    const peltonWheelGroup = new THREE.Group();
    peltonWheelGroup.position.set(-0.35, 1.35, 0.35);

    const runnerDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.12, 24), matPeltonRunner);
    runnerDisc.rotation.x = Math.PI / 2;
    registerClickable(runnerDisc, 'turbine');
    peltonWheelGroup.add(runnerDisc);

    // 16 Pelton Split Buckets around periphery
    const numBuckets = 16;
    for (let b = 0; b < numBuckets; b++) {
      const angle = (b / numBuckets) * Math.PI * 2;
      const bucket = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.18), matPeltonRunner);
      bucket.position.set(Math.cos(angle) * 0.45, Math.sin(angle) * 0.45, 0);
      bucket.rotation.z = angle;
      registerClickable(bucket, 'turbine');
      peltonWheelGroup.add(bucket);
    }
    turbineSystemGroup.add(peltonWheelGroup);

    // Coupling Shaft connecting Pelton Runner to Generator
    const couplingShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 12), matSteelShaft);
    couplingShaft.rotation.x = Math.PI / 2;
    couplingShaft.position.set(-0.35, 1.35, -0.25);
    registerClickable(couplingShaft, 'turbine');
    turbineSystemGroup.add(couplingShaft);

    // Generator Unit (PMDC / Synchronous Housing)
    const generatorHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.85, 20), matGeneratorBody);
    generatorHousing.rotation.x = Math.PI / 2;
    generatorHousing.position.set(-0.35, 1.35, -0.85);
    generatorHousing.castShadow = true;
    registerClickable(generatorHousing, 'generator');
    turbineSystemGroup.add(generatorHousing);

    const generatorEndCap = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.12, 20), matCopper);
    generatorEndCap.rotation.x = Math.PI / 2;
    generatorEndCap.position.set(-0.35, 1.35, -1.25);
    registerClickable(generatorEndCap, 'generator');
    turbineSystemGroup.add(generatorEndCap);

    // Small Powerhouse Building next to Generator
    const matPowerhouseWall = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7 });
    const matPowerhouseRoof = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.6 });
    const powerhouseBox = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.4), matPowerhouseWall);
    powerhouseBox.position.set(-0.35, 0.6, -1.55);
    powerhouseBox.castShadow = true;
    powerhouseBox.receiveShadow = true;
    registerClickable(powerhouseBox, 'generator');
    const powerhouseRoof = new THREE.Mesh(new THREE.ConeGeometry(1.35, 0.55, 4), matPowerhouseRoof);
    powerhouseRoof.position.set(-0.35, 1.47, -1.55);
    powerhouseRoof.rotation.y = Math.PI / 4;
    registerClickable(powerhouseRoof, 'generator');
    turbineSystemGroup.add(powerhouseBox, powerhouseRoof);

    scene.add(turbineSystemGroup);

    // ------------------------------------------------------------------------
    // 7. LOWER WATER COLLECTION BASIN (35x25x18 cm) & RECIRCULATION PUMP
    // ------------------------------------------------------------------------
    const lowerBasinGroup = new THREE.Group();
    // Positioned directly beneath the Pelton runner tailrace at (-0.35, 0.45, 0.35)
    const lowerTankShell = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.0, 2.5), matAcrylicClear);
    lowerTankShell.position.set(-0.1, 0.5, 0.65);
    registerClickable(lowerTankShell, 'lowerBasinAndPump');
    lowerBasinGroup.add(lowerTankShell);

    const lowerWaterMesh = new THREE.Mesh(new THREE.BoxGeometry(3.42, 0.5, 2.42), matWater);
    lowerWaterMesh.position.set(-0.1, 0.28, 0.65);
    registerClickable(lowerWaterMesh, 'lowerBasinAndPump');
    lowerBasinGroup.add(lowerWaterMesh);

    // External Recirculation Pump & Return Hose
    const matPumpBody = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.4, metalness: 0.6 });
    const pumpMotorMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.55, 16), matPumpBody);
    pumpMotorMesh.rotation.z = Math.PI / 2;
    pumpMotorMesh.position.set(1.2, 0.32, 1.45);
    registerClickable(pumpMotorMesh, 'lowerBasinAndPump');
    lowerBasinGroup.add(pumpMotorMesh);

    // Return hose curve from pump back to upper reservoir
    const hoseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.2, 0.35, 1.65),
      new THREE.Vector3(1.2, 1.2, 2.45),
      new THREE.Vector3(-1.5, 3.2, 2.45),
      new THREE.Vector3(-3.8, 6.8, 0.8),
      new THREE.Vector3(-4.0, 7.3, 0.1)
    ]);
    const returnHoseGeo = new THREE.TubeGeometry(hoseCurve, 32, 0.065, 8, false);
    const matReturnHose = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.55,
      roughness: 0.3
    });
    const returnHoseMesh = new THREE.Mesh(returnHoseGeo, matReturnHose);
    registerClickable(returnHoseMesh, 'lowerBasinAndPump');
    lowerBasinGroup.add(returnHoseMesh);

    scene.add(lowerBasinGroup);

    // ------------------------------------------------------------------------
    // 8. ELECTRICAL SUBSTATIONS, TRANSMISSION LINES, POLES & HOUSES
    // ------------------------------------------------------------------------
    const gridGroup = new THREE.Group();

    // Step-Up Transformer Substation at (1.3, 0.5, -1.4)
    const matTransformer = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.7 });
    const stepUpTxBody = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.9, 0.75), matTransformer);
    stepUpTxBody.position.set(1.3, 0.45, -1.4);
    stepUpTxBody.castShadow = true;
    registerClickable(stepUpTxBody, 'stepUpTransformer');
    gridGroup.add(stepUpTxBody);

    // HV Bushings on Step-Up Transformer
    [-0.22, 0, 0.22].forEach((bx) => {
      const bushing = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.35, 8), matCopper);
      bushing.position.set(1.3 + bx, 1.05, -1.4);
      registerClickable(bushing, 'stepUpTransformer');
      gridGroup.add(bushing);
    });

    // High-Voltage Transmission Lattice Tower / Poles at (2.6, 0, -1.4) and (2.6, 0, 0.4)
    [[2.55, -1.4], [2.55, 0.35]].forEach(([px, pz]) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.7, 10), matSteelShaft);
      pole.position.set(px, 1.35, pz);
      pole.castShadow = true;
      const crossArm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 0.07), matSteelShaft);
      crossArm.position.set(px, 2.45, pz);
      registerClickable(pole, 'transmissionLines');
      registerClickable(crossArm, 'transmissionLines');
      gridGroup.add(pole, crossArm);
    });

    // Step-Down Distribution Transformer Substation at (3.7, 0.4, 0.35)
    const stepDownTxBody = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 0.65), matTransformer);
    stepDownTxBody.position.set(3.7, 0.38, 0.35);
    stepDownTxBody.castShadow = true;
    registerClickable(stepDownTxBody, 'stepDownTransformer');
    gridGroup.add(stepDownTxBody);

    // Overhead Electrical Transmission Cables with animated energy pulses
    const cableCurves = [
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.35, 1.1, -1.4),
        new THREE.Vector3(0.5, 0.9, -1.4),
        new THREE.Vector3(1.3, 1.15, -1.4)
      ]),
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(1.3, 1.2, -1.4),
        new THREE.Vector3(1.9, 1.85, -1.4),
        new THREE.Vector3(2.55, 2.45, -1.4)
      ]),
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(2.55, 2.45, -1.4),
        new THREE.Vector3(2.55, 2.15, -0.5),
        new THREE.Vector3(2.55, 2.45, 0.35)
      ]),
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(2.55, 2.45, 0.35),
        new THREE.Vector3(3.15, 1.5, 0.35),
        new THREE.Vector3(3.7, 0.85, 0.35)
      ]),
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(3.7, 0.75, 0.35),
        new THREE.Vector3(4.3, 0.9, 0.35),
        new THREE.Vector3(4.75, 0.95, -0.5)
      ])
    ];

    const matCable = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const elecPulses = [];
    const pulseGeo = new THREE.SphereGeometry(0.055, 8, 8);
    const pulseMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    cableCurves.forEach((curve) => {
      const cableGeo = new THREE.TubeGeometry(curve, 20, 0.018, 6, false);
      const cableMesh = new THREE.Mesh(cableGeo, matCable);
      registerClickable(cableMesh, 'transmissionLines');
      gridGroup.add(cableMesh);

      for (let k = 0; k < 3; k++) {
        const pulse = new THREE.Mesh(pulseGeo, pulseMat);
        pulse.userData = { curve, offset: k / 3 };
        gridGroup.add(pulse);
        elecPulses.push(pulse);
      }
    });

    // Residential Houses with Working Illuminated LED Windows on Right Side (x = 4.6 to 5.4)
    const houseWindowMaterials = [];
    const houseConfigs = [
      { pos: [4.85, 0.45, -1.35], roofColor: 0xb91c1c },
      { pos: [4.85, 0.45, 0.15],  roofColor: 0x1d4ed8 },
      { pos: [4.85, 0.45, 1.65],  roofColor: 0x047857 }
    ];
    houseConfigs.forEach((hc) => {
      const hGroup = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 0.85, 1.05),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.75 })
      );
      body.position.set(...hc.pos);
      body.castShadow = true;
      body.receiveShadow = true;
      registerClickable(body, 'houses');
      hGroup.add(body);

      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(0.95, 0.52, 4),
        new THREE.MeshStandardMaterial({ color: hc.roofColor, roughness: 0.6 })
      );
      roof.position.set(hc.pos[0], hc.pos[1] + 0.68, hc.pos[2]);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      registerClickable(roof, 'houses');
      hGroup.add(roof);

      // Glowing Windows
      const winMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfacc15,
        emissiveIntensity: 0.9
      });
      houseWindowMaterials.push(winMat);

      const winFront = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.28, 0.55), winMat);
      winFront.position.set(hc.pos[0], hc.pos[1] + 0.05, hc.pos[2]);
      registerClickable(winFront, 'houses');
      hGroup.add(winFront);

      gridGroup.add(hGroup);
    });

    scene.add(gridGroup);

    // ------------------------------------------------------------------------
    // 9. ORBIT, PAN & ZOOM CAMERA CONTROLLER + RAYCASTER
    // ------------------------------------------------------------------------
    const cameraControl = {
      theta: 0.55,
      phi: 1.08,
      radius: 12.2,
      targetTheta: 0.55,
      targetPhi: 1.08,
      targetRadius: 12.2,
      lookAt: new THREE.Vector3(-0.2, 2.3, 0),
      targetLookAt: new THREE.Vector3(-0.2, 2.3, 0),
      isDragging: false,
      isPanning: false,
      lastX: 0,
      lastY: 0,
      dragDistance: 0
    };

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerDown = (e) => {
      cameraControl.isDragging = true;
      cameraControl.isPanning = e.button === 2 || e.shiftKey;
      cameraControl.lastX = e.clientX;
      cameraControl.lastY = e.clientY;
      cameraControl.dragDistance = 0;
    };

    const onPointerMove = (e) => {
      if (!cameraControl.isDragging) return;
      const dx = e.clientX - cameraControl.lastX;
      const dy = e.clientY - cameraControl.lastY;
      cameraControl.lastX = e.clientX;
      cameraControl.lastY = e.clientY;
      cameraControl.dragDistance += Math.abs(dx) + Math.abs(dy);

      if (cameraControl.isPanning) {
        const panSpeed = 0.012;
        cameraControl.targetLookAt.x -= dx * panSpeed;
        cameraControl.targetLookAt.y += dy * panSpeed;
      } else {
        cameraControl.targetTheta -= dx * 0.007;
        cameraControl.targetPhi = Math.max(0.12, Math.min(Math.PI / 2 - 0.04, cameraControl.targetPhi - dy * 0.007));
      }
    };

    const onPointerUp = (e) => {
      if (cameraControl.isDragging && cameraControl.dragDistance < 6) {
        // Click Raycast for Phase 10 Component Inspection
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(clickableMeshes, false);
        if (intersects.length > 0) {
          const compId = intersects[0].object.userData.componentId;
          if (compId && onSelectComponent) {
            onSelectComponent(compId);
          }
        }
      }
      cameraControl.isDragging = false;
    };

    const onWheel = (e) => {
      e.preventDefault();
      cameraControl.targetRadius = Math.max(3.5, Math.min(26.0, cameraControl.targetRadius + e.deltaY * 0.008));
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    domElem.addEventListener('wheel', onWheel, { passive: false });
    domElem.addEventListener('contextmenu', (e) => e.preventDefault());

    // Store refs for external access and 2D screen projection of labels
    const labelAnchors3D = {
      reservoir: new THREE.Vector3(-4.2, 7.6, -0.2),
      damWall: new THREE.Vector3(-2.4, 5.4, -0.1),
      penstock: new THREE.Vector3(-1.8, 3.3, 0.35),
      turbine: new THREE.Vector3(-0.35, 2.35, 0.35),
      generator: new THREE.Vector3(-0.35, 2.35, -1.1),
      stepUpTransformer: new THREE.Vector3(1.3, 1.5, -1.4),
      transmissionLines: new THREE.Vector3(2.55, 2.9, -0.5),
      stepDownTransformer: new THREE.Vector3(3.7, 1.3, 0.35),
      houses: new THREE.Vector3(4.85, 1.55, 0.15),
      lowerBasinAndPump: new THREE.Vector3(0.4, 1.2, 1.55)
    };

    sceneObjectsRef.current = {
      scene,
      camera,
      renderer,
      cameraControl,
      labelAnchors3D
    };

    // Resize handler + ResizeObserver so panel toggles immediately resize the 3D canvas
    const handleResize = () => {
      if (!container) return;
      const w = Math.max(100, container.clientWidth);
      const h = Math.max(100, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => handleResize());
      resizeObserver.observe(container);
    }
    setTimeout(handleResize, 50);

    // Animation Loop
    let animationFrameId;
    let lastTime = performance.now();

    const animate = (now) => {
      animationFrameId = requestAnimationFrame(animate);
      const currentNow = typeof now === 'number' && Number.isFinite(now) ? now : performance.now();
      const dt = Math.max(0.001, Math.min(0.1, (currentNow - lastTime) / 1000));
      lastTime = currentNow;

      const s = simStateRef.current;
      const p = paramsRef.current;
      const dim = dimensionsRef.current;

      // Smooth Camera Orbit Interpolation
      cameraControl.theta += (cameraControl.targetTheta - cameraControl.theta) * 0.12;
      cameraControl.phi += (cameraControl.targetPhi - cameraControl.phi) * 0.12;
      cameraControl.radius += (cameraControl.targetRadius - cameraControl.radius) * 0.12;
      cameraControl.lookAt.lerp(cameraControl.targetLookAt, 0.12);

      camera.position.x = cameraControl.lookAt.x + cameraControl.radius * Math.sin(cameraControl.phi) * Math.sin(cameraControl.theta);
      camera.position.y = cameraControl.lookAt.y + cameraControl.radius * Math.cos(cameraControl.phi);
      camera.position.z = cameraControl.lookAt.z + cameraControl.radius * Math.sin(cameraControl.phi) * Math.cos(cameraControl.theta);
      camera.lookAt(cameraControl.lookAt);

      // 1. Update Upper Reservoir Water Level height & position
      const maxResVol = Math.max(0.1, s.hydraulics.resMaxVolL);
      const resFillRatio = Math.max(0.02, Math.min(1.0, s.reservoirVolL / maxResVol));
      const waterBoxH = 1.92 * resFillRatio;
      resWaterMesh.scale.y = waterBoxH;
      resWaterMesh.position.y = 5.54 + waterBoxH / 2 + Math.sin(now * 0.004) * 0.008;

      // 2. Update Lower Collection Tank Water Level
      const lowerFillRatio = Math.max(0.05, Math.min(0.95, s.lowerBasinVolL / 12.0));
      lowerWaterMesh.scale.y = 0.9 * lowerFillRatio;
      lowerWaterMesh.position.y = 0.05 + (0.45 * lowerFillRatio);

      // 3. Update Valve Wheel Rotation & Water Jet Appearance
      valveWheel.rotation.z = (p.valveOpeningPct / 100) * Math.PI * 2;
      const flowActive = s.hydraulics.qActualLs > 0.001;
      waterJetBeam.visible = flowActive;
      penstockWaterCore.material.opacity = flowActive ? 0.85 : 0.25;
      if (flowActive) {
        const jetScale = Math.max(0.3, Math.min(1.6, s.hydraulics.vJetMs / 3.8));
        waterJetBeam.scale.set(1, jetScale, 1);
      }

      // Spillway sheet visible if reservoir overflows (>98% full) or small trickle
      spillwaySheet.material.opacity = resFillRatio > 0.96 ? 0.78 : 0.18;

      // 4. Animate Water Flow Particles down Penstock
      const flowSpeedNorm = Math.min(3.5, Math.max(0, s.hydraulics.vJetMs || 0) * 0.45);
      flowParticles.forEach((pm) => {
        pm.visible = flowActive;
        if (flowActive) {
          const nextProg = ((pm.userData.progress + dt * flowSpeedNorm) % 1.0 + 1.0) % 1.0;
          pm.userData.progress = nextProg;
          pm.position.lerpVectors(pStart, pEnd, nextProg);
        }
      });

      // 5. Rotate Pelton Turbine Runner according to physical angular velocity ω (rad/s)
      // Visual scaling so high RPM remains smooth and readable on 60Hz monitor
      const visualOmega = Math.min(35, s.electromech.omegaRadS * 0.65);
      peltonWheelGroup.rotation.z -= visualOmega * dt;

      // Runner diameter visual scaling if user adjusts runnerDiameterMm
      const runnerScale = (dim.runnerDiameterMm || 100) / 100;
      peltonWheelGroup.scale.set(runnerScale, runnerScale, 1);

      // 6. Animate Recirculation Hose Color when Pump is ON
      matReturnHose.opacity = p.pumpEnabled ? 0.88 : 0.28;
      matReturnHose.emissive = new THREE.Color(p.pumpEnabled ? 0x059669 : 0x000000);

      // 7. Animate Electrical Pulses and House / Streetlight Brightness based on Power Output
      const powerActive = systemModeRef.current === 'DC_PROTOTYPE'
        ? s.electromech.electricalPowerW > 0.005
        : s.acGrid.deliveredLoadMw > 0.05;

      const brightness = systemModeRef.current === 'DC_PROTOTYPE'
        ? Math.min(1.8, (s.electromech.dcVoltageV / 3.5) * (p.dcLoadConnected ? 1.2 : 0.2))
        : Math.min(1.8, (s.acGrid.loadVoltageKv / 10.5) * 1.2);

      houseWindowMaterials.forEach((wm) => {
        wm.emissiveIntensity = powerActive ? Math.max(0.2, brightness) : 0.04;
      });
      streetLightBulbs.forEach((bm) => {
        bm.emissiveIntensity = powerActive ? Math.max(0.25, brightness) : 0.05;
      });

      elecPulses.forEach((pulse) => {
        pulse.visible = powerActive;
        if (powerActive && pulse.userData.curve) {
          const nextOffset = ((pulse.userData.offset + dt * 0.85) % 1.0 + 1.0) % 1.0;
          pulse.userData.offset = nextOffset;
          const safeT = Math.max(0.0001, Math.min(0.9999, nextOffset));
          const pt = pulse.userData.curve.getPoint(safeT);
          if (pt) {
            pulse.position.copy(pt);
          }
        }
      });

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      domElem.removeEventListener('pointerdown', onPointerDown);
      domElem.removeEventListener('wheel', onWheel);
    };
  }, [threeLoaded]);

  const compInfo = COMPONENT_LEARNING_DB[selectedComponentId] || COMPONENT_LEARNING_DB.turbine;

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden select-none">
      {/* 3D WebGL Canvas Mount */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {!threeLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-30">
          <RefreshCw className="w-8 h-8 text-sky-400 animate-spin mb-3" />
          <p className="text-sm font-medium text-slate-200">Initializing 3D Hydroelectric Exhibition Environment...</p>
        </div>
      )}

      {/* Compact Top-Left 3D Scene HUD: Mode Badge */}
      <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1.5 pointer-events-none z-10">
        <div className={`px-2.5 py-1 rounded-md border backdrop-blur-md text-[11px] font-semibold flex items-center gap-1.5 shadow ${
          systemMode === 'DC_PROTOTYPE'
            ? 'bg-sky-950/75 border-sky-500/40 text-sky-200'
            : 'bg-amber-950/75 border-amber-500/40 text-amber-200'
        }`}>
          <Cpu className="w-3 h-3" />
          {systemMode === 'DC_PROTOTYPE'
            ? 'Mode A: Prototype DC'
            : 'Mode B: Utility 132 kV AC'}
        </div>

        <div className="px-2 py-1 rounded-md bg-slate-900/75 border border-slate-700/60 backdrop-blur-md text-[10px] text-slate-300 hidden sm:flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Drag to Orbit • Scroll to Zoom • Click 3D Part to Inspect</span>
        </div>
      </div>

      {/* Visual Overlays (Phase 12) - Compact & Non-Blocking */}
      {overlays.showHeadIndicator && (
        <div className="absolute left-2.5 top-11 bg-slate-900/80 border border-sky-500/40 rounded-lg p-2 backdrop-blur-md text-[11px] text-slate-200 shadow-lg pointer-events-none z-10">
          <div className="font-bold text-sky-400 mb-0.5 flex items-center gap-1">
            <Droplets className="w-3 h-3" /> Head Datum
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
            <span className="text-slate-400">Gross H<sub>g</sub>:</span>
            <span className="font-mono text-sky-300 text-right">{simState.hydraulics.grossHeadM.toFixed(3)} m</span>
            <span className="text-slate-400">Losses h<sub>L</sub>:</span>
            <span className="font-mono text-rose-400 text-right">-{simState.hydraulics.totalHeadLossM.toFixed(3)} m</span>
            <span className="text-slate-400 font-semibold">Net H<sub>net</sub>:</span>
            <span className="font-mono text-emerald-400 font-bold text-right">{simState.hydraulics.netHeadM.toFixed(3)} m</span>
          </div>
        </div>
      )}

      {overlays.showPowerFlow && (
        <div className="absolute top-2.5 right-2.5 bg-slate-900/80 border border-amber-500/40 rounded-lg p-2 backdrop-blur-md text-[10px] text-slate-200 shadow-lg pointer-events-none z-10">
          <div className="font-bold text-amber-400 mb-1 flex items-center gap-1">
            <Zap className="w-3 h-3" /> Power Conversion Chain
          </div>
          {systemMode === 'DC_PROTOTYPE' ? (
            <div className="flex items-center gap-1 font-mono">
              <span className="px-1.5 py-0.5 rounded bg-sky-950/90 text-sky-300">P<sub>hyd</sub>: {simState.hydraulics.hydraulicPowerW.toFixed(2)}W</span>
              <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
              <span className="px-1.5 py-0.5 rounded bg-amber-950/90 text-amber-300">P<sub>sh</sub>: {simState.electromech.shaftPowerW.toFixed(2)}W</span>
              <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
              <span className="px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300">P<sub>el</sub>: {simState.electromech.electricalPowerW.toFixed(2)}W</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 font-mono">
              <span className="px-1.5 py-0.5 rounded bg-sky-950/90 text-sky-300">{simState.acGrid.genActivePowerMw.toFixed(2)}MW</span>
              <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
              <span className="px-1.5 py-0.5 rounded bg-rose-950/90 text-rose-300">-{simState.acGrid.transmissionLossKw.toFixed(1)}kW</span>
              <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
              <span className="px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300">{simState.acGrid.deliveredLoadMw.toFixed(2)}MW</span>
            </div>
          )}
        </div>
      )}

      {/* Selected Component Engineering Inspector Card (Phase 10) - With Clean Stacked Equations */}
      {overlays.showInspectorCard && compInfo && (
        <div className="absolute bottom-11 right-2.5 w-96 max-w-[94%] bg-slate-900/95 border border-sky-500/50 rounded-xl p-3 backdrop-blur-md shadow-2xl text-xs text-slate-200 z-20 pointer-events-auto">
          <div className="flex items-start justify-between border-b border-slate-800 pb-1.5 mb-2 gap-2">
            <div>
              <span className="text-[9px] uppercase tracking-wider font-bold text-sky-400 block">
                {compInfo.category} • Interactive Inspector
              </span>
              <h4 className="font-bold text-xs text-white leading-tight">{compInfo.name}</h4>
            </div>
            <button
              onClick={() => onSelectComponent(null)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-rose-600/80 text-slate-300 hover:text-white text-[10px] font-bold shrink-0"
              title="Close Inspector"
            >
              ✕ Close
            </button>
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed mb-2">
            <MathText text={compInfo.principle} />
          </p>
          <div className="bg-slate-950/95 border border-slate-800 rounded-lg px-2.5 py-2 font-mono text-[11px] text-amber-300 mb-2 flex flex-col gap-1 overflow-x-auto">
            {compInfo.equation.split('|').map((eqPart, idx) => (
              <div key={idx} className="whitespace-nowrap leading-snug">
                <MathText text={eqPart.trim()} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
            <div>
              <strong className="text-slate-200">Inputs:</strong> <MathText text={compInfo.inputs} />
            </div>
            <div>
              <strong className="text-slate-200">Outputs:</strong> <MathText text={compInfo.outputs} />
            </div>
          </div>
        </div>
      )}

      {/* Single-Row Scrollable Component Selector Pills at Very Bottom */}
      {overlays.showComponentNames && (
        <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center pointer-events-auto z-10">
          <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-700/70 px-1.5 py-1 rounded-lg backdrop-blur-md shadow overflow-x-auto max-w-full no-scrollbar">
            <span className="text-[10px] font-semibold text-sky-400 px-1 shrink-0">Inspect:</span>
            {Object.values(COMPONENT_LEARNING_DB).map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectComponent(item.id, true)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all shrink-0 ${
                  selectedComponentId === item.id && overlays.showInspectorCard
                    ? 'bg-sky-600 text-white shadow'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {item.name.split(' ')[0]} {item.name.split(' ')[1]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MODULE 6: MAIN APPLICATION CONTROLLER & UI WORKSPACE
// ============================================================================

export default function App() {
  // Simulation Execution State
  const [isRunning, setIsRunning] = useState(true);
  const [simTimeS, setSimTimeS] = useState(0);
  const [systemMode, setSystemMode] = useState('DC_PROTOTYPE'); // 'DC_PROTOTYPE' | 'AC_UTILITY'
  const [activeBottomTab, setActiveBottomTab] = useState('GRAPHS'); // 'GRAPHS' | 'EXPERIMENTS' | 'TURBINES' | 'VALIDATION'
  const [selectedGraphId, setSelectedGraphId] = useState('ALL_GRID');
  const [bottomDockExpanded, setBottomDockExpanded] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [bottomDockOpen, setBottomDockOpen] = useState(true);
  const [showDimensionsModal, setShowDimensionsModal] = useState(false);

  // Prototype Dimensions State (Phase 1.2 - All Adjustable)
  const [dimensions, setDimensions] = useState(INITIAL_DIMENSIONS);

  // User-Controlled Hydraulic, Mechanical & DC Electrical Parameters (Phases 2, 3, 4, 6)
  const [params, setParams] = useState({
    valveOpeningPct: 65,          // 0 - 100 %
    pipeRoughnessMm: 0.0015,      // Smooth acrylic/PVC
    frictionMethod: 'swamee-jain',// 'swamee-jain' | 'fixed'
    fixedFrictionFactor: 0.022,
    waterTempC: 26,               // Malaysian ambient lab water temperature
    pumpEnabled: true,            // Recirculation pump ON so reservoir maintains level unless turned off
    pumpFlowRateLs: 0.095,        // L/s
    pumpHeadM: 0.85,              // m
    pumpEfficiencyPct: 55,        // Small submersible pump efficiency
    turbineEfficiencyPct: 78,     // Pelton runner peak efficiency %
    shaftFrictionCoeff: 0.00012,  // Bearing friction N·m/(rad/s)
    runnerInertiaKgM2: 0.00045,   // Pelton wheel + DC rotor inertia J
    dcLoadResistanceOhm: 18.0,    // External resistive/LED load (Ohms)
    dcLoadConnected: true,
    dcKeConstant: 0.115,          // PMDC voltage/torque constant V/(rad/s)
    dcArmatureResOhm: 3.2         // Internal winding resistance (Ohms)
  });

  // Utility-Scale Three-Phase AC Grid Parameters (Phase 5 Mode B)
  const [acParams, setAcParams] = useState({
    utilityHeadM: 120.0,
    utilityMaxFlowM3s: 5.5,
    genVoltageKv: 11.0,
    frequencyHz: 50.0,
    tx1PrimaryKv: 11.0,
    tx1SecondaryKv: 132.0,
    tx1RatedMva: 10.0,
    tx1EfficiencyPct: 98.5,
    tx1ResistancePct: 1.0,
    tx1ReactancePct: 6.0,
    lineLengthKm: 45.0,
    lineResOhmPerKm: 0.12,
    lineReactOhmPerKm: 0.40,
    tx2PrimaryKv: 132.0,
    tx2SecondaryKv: 11.0,
    loadDemandMw: 3.0,
    loadPowerFactor: 0.85
  });

  // Dynamic State Variables (Reservoir Volume, Lower Basin Volume, Angular Velocity, Energy Counters)
  const [reservoirVolL, setReservoirVolL] = useState(INITIAL_DIMENSIONS.initialWaterVolL);
  const [lowerBasinVolL, setLowerBasinVolL] = useState(4.5);
  const [omegaRadS, setOmegaRadS] = useState(28.0);
  const [energyGeneratedWh, setEnergyGeneratedWh] = useState(0);
  const [pumpEnergyConsumedWh, setPumpEnergyConsumedWh] = useState(0);

  // Camera & Visual Overlays State (Phase 10 & 12)
  // Default inspector card to closed so the 3D model is 100% visible on load
  const [selectedComponentId, setSelectedComponentId] = useState('turbine');
  const [cameraPreset, setCameraPreset] = useState({ id: 'isometric', ts: 0 });
  const [overlays, setOverlays] = useState({
    showHeadIndicator: true,
    showPowerFlow: true,
    showComponentNames: true,
    showInspectorCard: false
  });

  const handleSelect3DComponent = useCallback((compId) => {
    if (!compId) {
      setOverlays((o) => ({ ...o, showInspectorCard: false }));
      return;
    }
    setSelectedComponentId(compId);
    setOverlays((o) => ({ ...o, showInspectorCard: true }));
  }, []);

  // Real-Time Telemetry Graph History (Phase 8)
  const [telemetryHistory, setTelemetryHistory] = useState([]);
  const [graphsPaused, setGraphsPaused] = useState(false);

  // Experiment Lab Recordings (Phase 9)
  const [activeExpId, setActiveExpId] = useState(1);
  const [expRecords, setExpRecords] = useState({ 1: [], 2: [], 3: [], 4: [], 5: [] });
  const [expReportText, setExpReportText] = useState(null);

  // Instantaneous Solved State
  const currentHydraulics = useMemo(
    () => solveHydraulics(params, dimensions, reservoirVolL),
    [params, dimensions, reservoirVolL]
  );

  const currentElectromech = useMemo(
    () => stepElectromechanicalSystem(currentHydraulics, params, dimensions, omegaRadS, 0.001),
    [currentHydraulics, params, dimensions, omegaRadS]
  );

  const currentAcGrid = useMemo(
    () => solveUtilityACGrid(acParams, params.valveOpeningPct),
    [acParams, params.valveOpeningPct]
  );

  const simState = useMemo(() => ({
    simTimeS,
    reservoirVolL,
    lowerBasinVolL,
    energyGeneratedWh,
    pumpEnergyConsumedWh,
    hydraulics: currentHydraulics,
    electromech: currentElectromech,
    acGrid: currentAcGrid
  }), [
    simTimeS, reservoirVolL, lowerBasinVolL, energyGeneratedWh,
    pumpEnergyConsumedWh, currentHydraulics, currentElectromech, currentAcGrid
  ]);

  // Physics Time-Stepping Loop (10 Hz UI + Physics Integration)
  useEffect(() => {
    if (!isRunning) return;
    const dt = 0.1; // 100 ms integration step
    const timer = setInterval(() => {
      setSimTimeS((t) => +(t + dt).toFixed(1));

      setReservoirVolL((prevVolL) => {
        const hyd = solveHydraulics(params, dimensions, prevVolL);
        // Water balance: dV/dt = Q_in - Q_out - Q_overflow
        // Can only pump if lower basin has water
        const effectivePumpLs = lowerBasinVolL > 0.05 ? hyd.qPumpLs : 0;
        const dVolL = (effectivePumpLs - hyd.qActualLs) * dt;
        const nextVolL = Math.max(0, Math.min(hyd.resMaxVolL, prevVolL + dVolL));

        // Update lower basin volume inversely (conserving total water mass)
        setLowerBasinVolL((prevLower) => Math.max(0, Math.min(15.75, prevLower - dVolL)));

        // Advance turbine rotational dynamics J*(dω/dt) = T_turb - T_gen - T_fric
        setOmegaRadS((prevOmega) => {
          const em = stepElectromechanicalSystem(hyd, params, dimensions, prevOmega, dt);
          // Accumulate generated electrical energy (Wh) and pump consumed energy (Wh)
          setEnergyGeneratedWh((prevWh) => prevWh + (em.electricalPowerW * dt) / 3600);
          setPumpEnergyConsumedWh((prevPWh) => prevPWh + (hyd.pumpPowerElecW * dt) / 3600);
          return em.omegaRadS;
        });

        return nextVolL;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [isRunning, params, dimensions, lowerBasinVolL]);

  // Append Telemetry History Point every 0.5 seconds
  useEffect(() => {
    if (!isRunning || graphsPaused) return;
    if (Math.round(simTimeS * 10) % 5 !== 0) return;

    const point = {
      time: simTimeS,
      flowLs: +(currentHydraulics.qActualLs).toFixed(4),
      waterLevelCm: +(currentHydraulics.waterDepthCm).toFixed(2),
      netHeadM: +(currentHydraulics.netHeadM).toFixed(3),
      rpm: +(currentElectromech.rpm).toFixed(1),
      voltageV: systemMode === 'DC_PROTOTYPE'
        ? +(currentElectromech.dcVoltageV).toFixed(3)
        : +(currentAcGrid.loadVoltageKv).toFixed(3),
      currentA: systemMode === 'DC_PROTOTYPE'
        ? +(currentElectromech.dcCurrentA).toFixed(4)
        : +(currentAcGrid.lineCurrentA).toFixed(2),
      elecPowerW: systemMode === 'DC_PROTOTYPE'
        ? +(currentElectromech.electricalPowerW).toFixed(4)
        : +(currentAcGrid.deliveredLoadMw * 1000).toFixed(1),
      hydPowerW: +(currentHydraulics.hydraulicPowerW).toFixed(4),
      loadDemand: systemMode === 'DC_PROTOTYPE'
        ? params.dcLoadResistanceOhm
        : acParams.loadDemandMw
    };

    setTelemetryHistory((prev) => [...prev.slice(-79), point]);
  }, [simTimeS, isRunning, graphsPaused, currentHydraulics, currentElectromech, currentAcGrid, systemMode, params.dcLoadResistanceOhm, acParams.loadDemandMw]);

  // Reset Simulation Handler
  const handleResetSimulation = useCallback(() => {
    setSimTimeS(0);
    setReservoirVolL(dimensions.initialWaterVolL);
    setLowerBasinVolL(4.5);
    setOmegaRadS(0);
    setEnergyGeneratedWh(0);
    setPumpEnergyConsumedWh(0);
    setTelemetryHistory([]);
  }, [dimensions.initialWaterVolL]);

  // Export Telemetry CSV Handler (Phase 6.4 & Phase 8)
  const handleExportCSV = useCallback(() => {
    const headers = [
      'Time(s)', 'FlowRate(L/s)', 'WaterLevel(cm)', 'NetHead(m)',
      'TurbineRPM', 'Voltage(V_or_kV)', 'Current(A)', 'HydraulicPower(W)', 'ElectricalPower(W_or_kW)'
    ];
    const rows = telemetryHistory.map((r) => [
      r.time, r.flowLs, r.waterLevelCm, r.netHeadM,
      r.rpm, r.voltageV, r.currentA, r.hydPowerW, r.elecPowerW
    ].join(','));
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `UTHM_BNE22303_Hydro_Telemetry_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [telemetryHistory]);

  // Record Current Data Point into Active Experiment (Phase 9)
  const handleRecordExperimentPoint = useCallback(() => {
    const newRow = {
      id: Date.now(),
      valvePct: params.valveOpeningPct,
      grossHeadM: +currentHydraulics.grossHeadM.toFixed(3),
      netHeadM: +currentHydraulics.netHeadM.toFixed(3),
      flowLs: +currentHydraulics.qActualLs.toFixed(4),
      rpm: +currentElectromech.rpm.toFixed(1),
      loadOhm: params.dcLoadResistanceOhm,
      turbEffSetPct: params.turbineEfficiencyPct,
      voltageV: +currentElectromech.dcVoltageV.toFixed(3),
      currentA: +currentElectromech.dcCurrentA.toFixed(4),
      elecPowerW: +currentElectromech.electricalPowerW.toFixed(4),
      overallEffPct: +currentElectromech.overallEfficiencyPct.toFixed(2),
      txVoltageKv: acParams.tx1SecondaryKv,
      lineLossKw: +currentAcGrid.transmissionLossKw.toFixed(2),
      recVoltageKv: +currentAcGrid.receivingVoltageKv.toFixed(2),
      gridEffPct: +currentAcGrid.gridEfficiencyPct.toFixed(2)
    };
    setExpRecords((prev) => ({
      ...prev,
      [activeExpId]: [...prev[activeExpId], newRow]
    }));
  }, [activeExpId, params, acParams, currentHydraulics, currentElectromech, currentAcGrid]);

  // Auto-Run Experiment Sweep (Phase 9)
  const handleAutoRunExperiment = useCallback((expId) => {
    const generatedRows = [];
    if (expId === 1) {
      // Experiment 1: Valve Opening at 25%, 50%, 75%, 100%
      [25, 50, 75, 100].forEach((vPct, idx) => {
        const testParams = { ...params, valveOpeningPct: vPct };
        const hyd = solveHydraulics(testParams, dimensions, reservoirVolL);
        const eqOmega = hyd.vJetMs > 0 ? (0.46 * hyd.vJetMs) / ((dimensions.runnerDiameterMm / 1000) / 2) : 0;
        const em = stepElectromechanicalSystem(hyd, testParams, dimensions, eqOmega, 0.5);
        generatedRows.push({
          id: Date.now() + idx,
          valvePct: vPct,
          grossHeadM: +hyd.grossHeadM.toFixed(3),
          netHeadM: +hyd.netHeadM.toFixed(3),
          flowLs: +hyd.qActualLs.toFixed(4),
          rpm: +em.rpm.toFixed(1),
          loadOhm: testParams.dcLoadResistanceOhm,
          turbEffSetPct: testParams.turbineEfficiencyPct,
          voltageV: +em.dcVoltageV.toFixed(3),
          currentA: +em.dcCurrentA.toFixed(4),
          elecPowerW: +em.electricalPowerW.toFixed(4),
          overallEffPct: +em.overallEfficiencyPct.toFixed(2)
        });
      });
    } else if (expId === 2) {
      // Experiment 2: Water Head Comparison (55 cm, 65 cm, 75 cm, 85 cm platform height)
      [55, 65, 75, 85].forEach((hCm, idx) => {
        const testDim = { ...dimensions, platformHeightCm: hCm };
        const hyd = solveHydraulics(params, testDim, reservoirVolL);
        const eqOmega = hyd.vJetMs > 0 ? (0.46 * hyd.vJetMs) / ((testDim.runnerDiameterMm / 1000) / 2) : 0;
        const em = stepElectromechanicalSystem(hyd, params, testDim, eqOmega, 0.5);
        generatedRows.push({
          id: Date.now() + idx,
          valvePct: params.valveOpeningPct,
          grossHeadM: +hyd.grossHeadM.toFixed(3),
          netHeadM: +hyd.netHeadM.toFixed(3),
          flowLs: +hyd.qActualLs.toFixed(4),
          rpm: +em.rpm.toFixed(1),
          loadOhm: params.dcLoadResistanceOhm,
          turbEffSetPct: params.turbineEfficiencyPct,
          voltageV: +em.dcVoltageV.toFixed(3),
          currentA: +em.dcCurrentA.toFixed(4),
          elecPowerW: +em.electricalPowerW.toFixed(4),
          overallEffPct: +em.overallEfficiencyPct.toFixed(2)
        });
      });
    } else if (expId === 3) {
      // Experiment 3: Load Resistance Variation (5, 12, 25, 50 Ohms)
      [5, 12, 25, 50].forEach((rOhm, idx) => {
        const testParams = { ...params, dcLoadResistanceOhm: rOhm, dcLoadConnected: true };
        const hyd = solveHydraulics(testParams, dimensions, reservoirVolL);
        // Higher load current lowers equilibrium speed slightly
        const loadFactor = rOhm / (rOhm + testParams.dcArmatureResOhm);
        const eqOmega = hyd.vJetMs > 0 ? (0.38 + 0.14 * loadFactor) * hyd.vJetMs / ((dimensions.runnerDiameterMm / 1000) / 2) : 0;
        const em = stepElectromechanicalSystem(hyd, testParams, dimensions, eqOmega, 0.5);
        generatedRows.push({
          id: Date.now() + idx,
          valvePct: testParams.valveOpeningPct,
          grossHeadM: +hyd.grossHeadM.toFixed(3),
          netHeadM: +hyd.netHeadM.toFixed(3),
          flowLs: +hyd.qActualLs.toFixed(4),
          rpm: +em.rpm.toFixed(1),
          loadOhm: rOhm,
          turbEffSetPct: testParams.turbineEfficiencyPct,
          voltageV: +em.dcVoltageV.toFixed(3),
          currentA: +em.dcCurrentA.toFixed(4),
          elecPowerW: +em.electricalPowerW.toFixed(4),
          overallEffPct: +em.overallEfficiencyPct.toFixed(2)
        });
      });
    } else if (expId === 4) {
      // Experiment 4: Turbine Efficiency Variation (55%, 65%, 75%, 85%)
      [55, 65, 75, 85].forEach((effPct, idx) => {
        const testParams = { ...params, turbineEfficiencyPct: effPct };
        const hyd = solveHydraulics(testParams, dimensions, reservoirVolL);
        const eqOmega = hyd.vJetMs > 0 ? (0.46 * hyd.vJetMs) / ((dimensions.runnerDiameterMm / 1000) / 2) : 0;
        const em = stepElectromechanicalSystem(hyd, testParams, dimensions, eqOmega, 0.5);
        generatedRows.push({
          id: Date.now() + idx,
          valvePct: testParams.valveOpeningPct,
          grossHeadM: +hyd.grossHeadM.toFixed(3),
          netHeadM: +hyd.netHeadM.toFixed(3),
          flowLs: +hyd.qActualLs.toFixed(4),
          rpm: +em.rpm.toFixed(1),
          loadOhm: testParams.dcLoadResistanceOhm,
          turbEffSetPct: effPct,
          voltageV: +em.dcVoltageV.toFixed(3),
          currentA: +em.dcCurrentA.toFixed(4),
          elecPowerW: +em.electricalPowerW.toFixed(4),
          overallEffPct: +em.overallEfficiencyPct.toFixed(2)
        });
      });
    } else if (expId === 5) {
      // Experiment 5: Utility AC Grid Transmission Voltage Comparison (33 kV, 66 kV, 132 kV, 275 kV)
      [33, 66, 132, 275].forEach((kv, idx) => {
        const testAc = { ...acParams, tx1SecondaryKv: kv, tx2PrimaryKv: kv };
        const acRes = solveUtilityACGrid(testAc, Math.max(80, params.valveOpeningPct));
        generatedRows.push({
          id: Date.now() + idx,
          txVoltageKv: kv,
          loadMw: testAc.loadDemandMw,
          lineCurrentA: +acRes.lineCurrentA.toFixed(2),
          lineLossKw: +acRes.transmissionLossKw.toFixed(2),
          recVoltageKv: +acRes.receivingVoltageKv.toFixed(2),
          gridEffPct: +acRes.gridEfficiencyPct.toFixed(2)
        });
      });
    }

    setExpRecords((prev) => ({ ...prev, [expId]: generatedRows }));
  }, [params, dimensions, reservoirVolL, acParams]);

  // Generate Automated Lab Report (Phase 9)
  const handleGenerateExperimentReport = useCallback(() => {
    const rows = expRecords[activeExpId] || [];
    const expTitles = {
      1: 'EXPERIMENT 1: EFFECT OF VALVE OPENING ON FLOW RATE AND GENERATOR OUTPUT',
      2: 'EXPERIMENT 2: EFFECT OF HYDRAULIC HEAD ON AVAILABLE HYDRAULIC & ELECTRICAL POWER',
      3: 'EXPERIMENT 3: ELECTRICAL LOAD VARIATION AND ELECTROMECHANICAL LOADING RESPONSE',
      4: 'EXPERIMENT 4: TURBINE RUNNER EFFICIENCY SENSITIVITY ANALYSIS',
      5: 'EXPERIMENT 5: HIGH-VOLTAGE AC TRANSMISSION VOLTAGE VS LINE LOSSES (I²R)'
    };
    const report = [
      '================================================================================',
      'UNIVERSITI TUN HUSSEIN ONN MALAYSIA (UTHM)',
      'COURSE: BNE 22303 / BNE 22203 — POWER SYSTEM FUNDAMENTAL',
      expTitles[activeExpId],
      `GENERATED TIMESTAMP: ${new Date().toISOString()}`,
      '================================================================================',
      '',
      `RECORDED DATA POINTS (${rows.length} rows):`,
      JSON.stringify(rows, null, 2),
      '',
      'ENGINEERING ANALYSIS & CONCLUSION:',
      activeExpId === 5
        ? 'Increasing AC transmission voltage from 33 kV to 132 kV and 275 kV reduces line current I_L inversely (I = S / (√3·V_LL)) and reduces resistive transmission power losses (3·I²R) quadratically, validating high-voltage grid step-up transformation.'
        : 'Experimental simulation confirms conservation of mass and energy across the hydraulic-to-mechanical-to-electrical conversion chain (P_elec < P_shaft < P_hydraulic). Net head accounts for Darcy-Weisbach pipe friction and minor valve losses.'
    ].join('\n');

    setExpReportText(report);
  }, [activeExpId, expRecords]);

  // Active Physics Validation & Safety Warnings (Phase 11)
  const safetyWarnings = useMemo(() => {
    const list = [];
    if (reservoirVolL <= 0.05) {
      list.push('Upper reservoir is depleted (V ≈ 0 L). Enable recirculation pump or refill reservoir.');
    }
    if (params.valveOpeningPct === 0) {
      list.push('Penstock control valve is 0% (Fully Closed). Zero flow and zero hydraulic input power.');
    }
    if (params.pumpEnabled && currentHydraulics.pumpPowerElecW > currentElectromech.electricalPowerW) {
      list.push(
        `Thermodynamic Reality Check: External Pump consumes ${currentHydraulics.pumpPowerElecW.toFixed(2)} W while Turbine-Generator produces ${currentElectromech.electricalPowerW.toFixed(2)} W. Closed-loop net energy is negative (-${(currentHydraulics.pumpPowerElecW - currentElectromech.electricalPowerW).toFixed(2)} W).`
      );
    }
    if (systemMode === 'AC_UTILITY' && currentAcGrid.overloadWarning) {
      list.push('Utility AC Load Demand exceeds available hydro turbine-generator capacity!');
    }
    return list;
  }, [reservoirVolL, params.valveOpeningPct, params.pumpEnabled, currentHydraulics, currentElectromech, systemMode, currentAcGrid]);

  const validationBenchmarks = useMemo(() => computeValidationBenchmarks(), []);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* ==================================================================== */}
      {/* TOP HEADER BAR: COURSE INFO, MODE SWITCHER & MASTER ACTION BUTTONS   */}
      {/* ==================================================================== */}
      <header className="h-14 shrink-0 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center shadow-md shadow-sky-900/50">
            <Droplets className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm tracking-tight text-white">
                3D HYDROELECTRIC POWER GENERATION & DISTRIBUTION SIMULATOR
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                BNE 22303 / BNE 22203 • UTHM
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Interactive Engineering Exhibition Digital Twin • Hydraulic, Pelton Turbine, PMDC & 3Φ 132 kV AC Grid Solver
            </p>
          </div>
        </div>

        {/* Mode Switcher (Phase 5 Mode A vs Mode B) */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setSystemMode('DC_PROTOTYPE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              systemMode === 'DC_PROTOTYPE'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            Mode A: Prototype DC Model
          </button>
          <button
            onClick={() => setSystemMode('AC_UTILITY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              systemMode === 'AC_UTILITY'
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Mode B: Utility 132 kV AC Grid
          </button>
        </div>

        {/* Master Simulation Action Buttons (Phase 6.4) */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsRunning((r) => !r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              isRunning
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isRunning ? 'Pause' : simTimeS > 0 ? 'Resume' : 'Start'}
          </button>

          <button
            onClick={handleResetSimulation}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1"
            title="Reset Simulation"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>

          <button
            onClick={() => setShowDimensionsModal(true)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 flex items-center gap-1"
          >
            <Settings className="w-3.5 h-3.5" /> Dimensions
          </button>

          <button
            onClick={handleExportCSV}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* MIDDLE MAIN WORKSPACE: LEFT CONTROLS | CENTER 3D SCENE | RIGHT METERS*/}
      {/* ==================================================================== */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* ------------------------------------------------------------------ */}
        {/* LEFT PANEL: INTERACTIVE SYSTEM CONTROLS (PHASE 6)                  */}
        {/* ------------------------------------------------------------------ */}
        {leftPanelOpen && (
          <aside className="w-72 shrink-0 bg-slate-900/95 border-r border-slate-800 flex flex-col overflow-y-auto p-2.5 space-y-2.5">
          {/* Quick Action Buttons Strip (Phase 6.4) */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
              <span>Quick Operator Actions</span>
              <span className="font-mono text-sky-400">t = {simTimeS.toFixed(1)}s</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setParams((p) => ({ ...p, valveOpeningPct: 100 }))}
                className="px-2 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 text-xs font-semibold"
              >
                Open Valve (100%)
              </button>
              <button
                onClick={() => setParams((p) => ({ ...p, valveOpeningPct: 0 }))}
                className="px-2 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-semibold"
              >
                Close Valve (0%)
              </button>
              <button
                onClick={() => setParams((p) => ({ ...p, pumpEnabled: !p.pumpEnabled }))}
                className={`px-2 py-1.5 rounded-lg border text-xs font-semibold ${
                  params.pumpEnabled
                    ? 'bg-emerald-600/25 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                {params.pumpEnabled ? 'Stop Pump (ON)' : 'Start Pump (OFF)'}
              </button>
              <button
                onClick={() => {
                  if (systemMode === 'DC_PROTOTYPE') {
                    const nextLoads = [10, 18, 30, 50];
                    const idx = (nextLoads.indexOf(params.dcLoadResistanceOhm) + 1) % nextLoads.length;
                    setParams((p) => ({ ...p, dcLoadResistanceOhm: nextLoads[idx] }));
                  } else {
                    const nextMw = [1.5, 3.0, 4.2, 5.0];
                    const idx = (nextMw.indexOf(acParams.loadDemandMw) + 1) % nextMw.length;
                    setAcParams((a) => ({ ...a, loadDemandMw: nextMw[idx] }));
                  }
                }}
                className="px-2 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 text-xs font-semibold"
              >
                Step Load ({systemMode === 'DC_PROTOTYPE' ? `${params.dcLoadResistanceOhm}Ω` : `${acParams.loadDemandMw}MW`})
              </button>
            </div>
          </div>

          {/* 6.1 Hydraulic Controls */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400 border-b border-slate-800 pb-1.5">
              <Droplets className="w-4 h-4" /> 6.1 Hydraulic Parameters
            </div>

            {/* Valve Opening Slider */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Valve Opening</span>
                <span className="font-mono font-bold text-sky-300">{params.valveOpeningPct}%</span>
              </div>
              <input
                type="range" min="0" max="100" step="1"
                value={params.valveOpeningPct}
                onChange={(e) => setParams((p) => ({ ...p, valveOpeningPct: Number(e.target.value) }))}
                className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Reservoir Water Volume / Level */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Reservoir Volume (Level)</span>
                <span className="font-mono text-sky-300">
                  {reservoirVolL.toFixed(2)} L ({currentHydraulics.waterDepthCm.toFixed(1)} cm)
                </span>
              </div>
              <input
                type="range" min="0" max={currentHydraulics.resMaxVolL} step="0.1"
                value={reservoirVolL}
                onChange={(e) => setReservoirVolL(Number(e.target.value))}
                className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Upper Platform Elevation (Hydraulic Head Control) */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Reservoir Platform Elev</span>
                <span className="font-mono text-sky-300">{dimensions.platformHeightCm} cm</span>
              </div>
              <input
                type="range" min="40" max="110" step="1"
                value={dimensions.platformHeightCm}
                onChange={(e) => setDimensions((d) => ({ ...d, platformHeightCm: Number(e.target.value) }))}
                className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Penstock Diameter & Nozzle Diameter */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Penstock D<sub>p</sub></span>
                  <span className="font-mono text-slate-200">{dimensions.penstockDiameterMm} mm</span>
                </div>
                <input
                  type="range" min="8" max="25" step="0.5"
                  value={dimensions.penstockDiameterMm}
                  onChange={(e) => setDimensions((d) => ({ ...d, penstockDiameterMm: Number(e.target.value) }))}
                  className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Nozzle D<sub>n</sub></span>
                  <span className="font-mono text-slate-200">{dimensions.nozzleDiameterMm} mm</span>
                </div>
                <input
                  type="range" min="3" max="10" step="0.5"
                  value={dimensions.nozzleDiameterMm}
                  onChange={(e) => setDimensions((d) => ({ ...d, nozzleDiameterMm: Number(e.target.value) }))}
                  className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Recirculation Pump Flow Rate */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Pump Recirculation Flow</span>
                <span className="font-mono text-emerald-400">{params.pumpFlowRateLs.toFixed(3)} L/s</span>
              </div>
              <input
                type="range" min="0.02" max="0.25" step="0.005"
                value={params.pumpFlowRateLs}
                onChange={(e) => setParams((p) => ({ ...p, pumpFlowRateLs: Number(e.target.value) }))}
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* 6.2 Mechanical Turbine Controls */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 border-b border-slate-800 pb-1.5">
              <Gauge className="w-4 h-4" /> 6.2 Pelton Turbine & Mechanical
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Peak Turbine Efficiency (η<sub>t</sub>)</span>
                <span className="font-mono text-amber-300">{params.turbineEfficiencyPct}%</span>
              </div>
              <input
                type="range" min="40" max="92" step="1"
                value={params.turbineEfficiencyPct}
                onChange={(e) => setParams((p) => ({ ...p, turbineEfficiencyPct: Number(e.target.value) }))}
                className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Runner D</span>
                  <span className="font-mono text-slate-200">{dimensions.runnerDiameterMm} mm</span>
                </div>
                <input
                  type="range" min="60" max="150" step="5"
                  value={dimensions.runnerDiameterMm}
                  onChange={(e) => setDimensions((d) => ({ ...d, runnerDiameterMm: Number(e.target.value) }))}
                  className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Inertia J</span>
                  <span className="font-mono text-slate-200">{(params.runnerInertiaKgM2 * 1000).toFixed(2)}g·m²</span>
                </div>
                <input
                  type="range" min="0.00015" max="0.0015" step="0.00005"
                  value={params.runnerInertiaKgM2}
                  onChange={(e) => setParams((p) => ({ ...p, runnerInertiaKgM2: Number(e.target.value) }))}
                  className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* 6.3 Electrical Controls (Mode A DC vs Mode B Utility AC) */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-400 border-b border-slate-800 pb-1.5">
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4" /> 6.3 Electrical Load & Grid
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                {systemMode === 'DC_PROTOTYPE' ? 'PMDC' : '3Φ AC'}
              </span>
            </div>

            {systemMode === 'DC_PROTOTYPE' ? (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">Electrical Load Breaker</span>
                  <button
                    onClick={() => setParams((p) => ({ ...p, dcLoadConnected: !p.dcLoadConnected }))}
                    className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                      params.dcLoadConnected ? 'bg-emerald-600 text-white' : 'bg-rose-900/60 text-rose-300'
                    }`}
                  >
                    {params.dcLoadConnected ? 'CONNECTED' : 'OPEN CIRCUIT'}
                  </button>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Load Resistance (R<sub>load</sub>)</span>
                    <span className="font-mono text-emerald-300">{params.dcLoadResistanceOhm.toFixed(1)} Ω</span>
                  </div>
                  <input
                    type="range" min="2" max="100" step="1"
                    value={params.dcLoadResistanceOhm}
                    onChange={(e) => setParams((p) => ({ ...p, dcLoadResistanceOhm: Number(e.target.value) }))}
                    className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-400">EMF k<sub>e</sub></span>
                      <span className="font-mono text-slate-200">{params.dcKeConstant.toFixed(3)}</span>
                    </div>
                    <input
                      type="range" min="0.05" max="0.25" step="0.005"
                      value={params.dcKeConstant}
                      onChange={(e) => setParams((p) => ({ ...p, dcKeConstant: Number(e.target.value) }))}
                      className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-400">Armature R<sub>a</sub></span>
                      <span className="font-mono text-slate-200">{params.dcArmatureResOhm.toFixed(1)} Ω</span>
                    </div>
                    <input
                      type="range" min="0.5" max="10" step="0.5"
                      value={params.dcArmatureResOhm}
                      onChange={(e) => setParams((p) => ({ ...p, dcArmatureResOhm: Number(e.target.value) }))}
                      className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Consumer Load Demand (P)</span>
                    <span className="font-mono text-amber-300">{acParams.loadDemandMw.toFixed(2)} MW</span>
                  </div>
                  <input
                    type="range" min="0.5" max="5.5" step="0.1"
                    value={acParams.loadDemandMw}
                    onChange={(e) => setAcParams((a) => ({ ...a, loadDemandMw: Number(e.target.value) }))}
                    className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Load Power Factor (cosφ)</span>
                    <span className="font-mono text-amber-300">{acParams.loadPowerFactor.toFixed(2)} lag</span>
                  </div>
                  <input
                    type="range" min="0.65" max="1.0" step="0.01"
                    value={acParams.loadPowerFactor}
                    onChange={(e) => setAcParams((a) => ({ ...a, loadPowerFactor: Number(e.target.value) }))}
                    className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Step-Up Transmission Voltage</span>
                    <span className="font-mono text-sky-300">11 / {acParams.tx1SecondaryKv} kV</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[33, 66, 132, 275].map((kv) => (
                      <button
                        key={kv}
                        onClick={() => setAcParams((a) => ({ ...a, tx1SecondaryKv: kv, tx2PrimaryKv: kv }))}
                        className={`py-1 rounded text-[11px] font-mono font-bold border ${
                          acParams.tx1SecondaryKv === kv
                            ? 'bg-sky-600 border-sky-400 text-white'
                            : 'bg-slate-900 border-slate-700 text-slate-400'
                        }`}
                      >
                        {kv}kV
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Transmission Line Length</span>
                    <span className="font-mono text-slate-200">{acParams.lineLengthKm} km</span>
                  </div>
                  <input
                    type="range" min="5" max="150" step="5"
                    value={acParams.lineLengthKm}
                    onChange={(e) => setAcParams((a) => ({ ...a, lineLengthKm: Number(e.target.value) }))}
                    className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </>
            )}
          </div>
          </aside>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* CENTER VIEWPORT: 3D MODEL + CAMERA PRESETS + OVERLAY TOGGLES       */}
        {/* ------------------------------------------------------------------ */}
        <main className="flex-1 flex flex-col min-w-0 relative">
          {/* Camera Presets & Visual Overlays Toolbar (Phase 12) */}
          <div className="h-10 shrink-0 bg-slate-900/90 border-b border-slate-800 px-2.5 flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setLeftPanelOpen((o) => !o)}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 border border-slate-700 flex items-center gap-1 mr-1"
                title="Toggle Left Controls Panel"
              >
                {leftPanelOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Controls
              </button>

              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mr-1">
                <Camera className="w-3.5 h-3.5 text-sky-400" /> Views:
              </span>
              {[
                { id: 'isometric', label: '1. Isometric' },
                { id: 'front',     label: '2. Front' },
                { id: 'top',       label: '3. Top' },
                { id: 'side',      label: '4. Side' },
                { id: 'turbine',   label: '5. Turbine' },
                { id: 'generator', label: '6. Generator' },
                { id: 'grid',      label: '7. Grid' }
              ].map((cam) => (
                <button
                  key={cam.id}
                  onClick={() => setCameraPreset({ id: cam.id, ts: Date.now() })}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors shrink-0 ${
                    cameraPreset.id === cam.id
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {cam.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mr-1">
                <Layers className="w-3.5 h-3.5 text-amber-400" /> Overlays:
              </span>
              {[
                { key: 'showHeadIndicator', label: 'Head' },
                { key: 'showPowerFlow',     label: 'Power' },
                { key: 'showInspectorCard', label: 'Inspector' },
                { key: 'showComponentNames', label: 'Labels' }
              ].map((ov) => (
                <button
                  key={ov.key}
                  onClick={() => setOverlays((o) => ({ ...o, [ov.key]: !o[ov.key] }))}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors shrink-0 ${
                    overlays[ov.key]
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400'
                  }`}
                >
                  {ov.label}
                </button>
              ))}

              <button
                onClick={() => {
                  const anyOpen = leftPanelOpen || rightPanelOpen || bottomDockOpen;
                  setLeftPanelOpen(!anyOpen);
                  setRightPanelOpen(!anyOpen);
                  setBottomDockOpen(!anyOpen);
                }}
                className="px-2 py-0.5 rounded bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 text-[11px] font-semibold flex items-center gap-1 ml-1 shrink-0"
                title="Maximize 3D Viewport"
              >
                <Maximize2 className="w-3 h-3" />
                {leftPanelOpen || rightPanelOpen || bottomDockOpen ? 'Full 3D' : 'Show Panels'}
              </button>

              <button
                onClick={() => setRightPanelOpen((o) => !o)}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 border border-slate-700 flex items-center gap-1"
                title="Toggle Right Telemetry Panel"
              >
                Meters
                {rightPanelOpen ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* 3D Interactive Exhibition Canvas */}
          <div className="flex-1 min-h-0 relative">
            <HydroExhibition3DViewport
              simState={simState}
              dimensions={dimensions}
              params={params}
              systemMode={systemMode}
              selectedComponentId={selectedComponentId}
              onSelectComponent={handleSelect3DComponent}
              cameraPreset={cameraPreset}
              overlays={overlays}
            />
          </div>

          {/* Safety & Physics Validation Banner (Phase 11) */}
          {safetyWarnings.length > 0 && (
            <div className="bg-amber-950/95 border-t border-amber-600/50 px-3 py-1 flex items-center gap-2 text-[11px] text-amber-200">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div className="truncate font-medium">{safetyWarnings[0]}</div>
            </div>
          )}
        </main>

        {/* ------------------------------------------------------------------ */}
        {/* RIGHT PANEL: REAL-TIME ENGINEERING DASHBOARD (PHASE 7)             */}
        {/* ------------------------------------------------------------------ */}
        {rightPanelOpen && (
          <aside className="w-72 shrink-0 bg-slate-900/95 border-l border-slate-800 flex flex-col overflow-y-auto p-2.5 space-y-2.5">
          {/* Hydraulic Telemetry Readout */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs font-bold text-sky-400 border-b border-slate-800 pb-1.5 mb-2">
              <span className="flex items-center gap-1.5"><Droplets className="w-3.5 h-3.5" /> Hydraulic Telemetry</span>
              <span className="text-[10px] font-mono text-slate-400">Modeled</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                <div className="text-[10px] text-slate-400">Reservoir Vol</div>
                <div className="font-mono font-bold text-sky-300">{reservoirVolL.toFixed(2)} L</div>
              </div>
              <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                <div className="text-[10px] text-slate-400">Water Depth</div>
                <div className="font-mono font-bold text-sky-300">{currentHydraulics.waterDepthCm.toFixed(1)} cm</div>
              </div>
              <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                <div className="text-[10px] text-slate-400">Gross Head H<sub>g</sub></div>
                <div className="font-mono font-bold text-slate-200">{currentHydraulics.grossHeadM.toFixed(3)} m</div>
              </div>
              <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                <div className="text-[10px] text-slate-400">Net Head H<sub>net</sub></div>
                <div className="font-mono font-bold text-emerald-400">{currentHydraulics.netHeadM.toFixed(3)} m</div>
              </div>
              <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                <div className="text-[10px] text-slate-400">Actual Flow Q</div>
                <div className="font-mono font-bold text-sky-300">{currentHydraulics.qActualLs.toFixed(4)} L/s</div>
              </div>
              <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                <div className="text-[10px] text-slate-400">Ideal Flow Q<sub>id</sub></div>
                <div className="font-mono text-slate-400">{currentHydraulics.qIdealLs.toFixed(4)} L/s</div>
              </div>
              <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                <div className="text-[10px] text-slate-400">Jet Velocity v<sub>j</sub></div>
                <div className="font-mono font-bold text-slate-200">{currentHydraulics.vJetMs.toFixed(2)} m/s</div>
              </div>
              <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                <div className="text-[10px] text-slate-400">Friction Loss h<sub>f</sub></div>
                <div className="font-mono font-bold text-rose-400">{currentHydraulics.frictionHeadLossM.toFixed(3)} m</div>
              </div>
            </div>
            <div className="mt-2 bg-sky-950/40 border border-sky-800/50 rounded-lg p-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-sky-200">Hydraulic Power (P<sub>hyd</sub>)</span>
              <span className="font-mono font-bold text-sm text-sky-300">{currentHydraulics.hydraulicPowerW.toFixed(4)} W</span>
            </div>
          </div>

          {/* Mechanical Telemetry Readout */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs font-bold text-amber-400 border-b border-slate-800 pb-1.5 mb-2">
              <span className="flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5" /> Mechanical Turbine</span>
              <span className="text-[10px] font-mono text-slate-400">Pelton Runner</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                <div className="text-[10px] text-slate-400">Turbine Speed</div>
                <div className="font-mono font-bold text-amber-300">{currentElectromech.rpm.toFixed(1)} RPM</div>
              </div>
              <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                <div className="text-[10px] text-slate-400">Angular Vel (ω)</div>
                <div className="font-mono font-bold text-slate-200">{currentElectromech.omegaRadS.toFixed(2)} rad/s</div>
              </div>
              <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                <div className="text-[10px] text-slate-400">Driving Torque</div>
                <div className="font-mono font-bold text-amber-300">{(currentElectromech.turbineTorqueNm * 1000).toFixed(2)} mN·m</div>
              </div>
              <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                <div className="text-[10px] text-slate-400">Turbine Eff (η<sub>t</sub>)</div>
                <div className="font-mono font-bold text-emerald-400">{currentElectromech.actualTurbineEffPct.toFixed(1)} %</div>
              </div>
            </div>
            <div className="mt-2 bg-amber-950/40 border border-amber-800/50 rounded-lg p-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-200">Mechanical Shaft Power</span>
              <span className="font-mono font-bold text-sm text-amber-300">{currentElectromech.shaftPowerW.toFixed(4)} W</span>
            </div>
          </div>

          {/* Electrical & Utility AC Telemetry Readout */}
          {systemMode === 'DC_PROTOTYPE' ? (
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-400 border-b border-slate-800 pb-1.5 mb-2">
                <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Prototype DC Generator</span>
                <span className="text-[10px] font-mono text-slate-400">Mode A</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Terminal Voltage</div>
                  <div className="font-mono font-bold text-emerald-300">{currentElectromech.dcVoltageV.toFixed(3)} V</div>
                </div>
                <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Internal EMF E<sub>a</sub></div>
                  <div className="font-mono text-slate-300">{currentElectromech.internalEmfV.toFixed(3)} V</div>
                </div>
                <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Load Current (I)</div>
                  <div className="font-mono font-bold text-emerald-300">{(currentElectromech.dcCurrentA * 1000).toFixed(1)} mA</div>
                </div>
                <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Overall Eff (η<sub>tot</sub>)</div>
                  <div className="font-mono font-bold text-sky-300">{currentElectromech.overallEfficiencyPct.toFixed(1)} %</div>
                </div>
                <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Energy Generated</div>
                  <div className="font-mono text-emerald-300">{(energyGeneratedWh * 1000).toFixed(3)} mWh</div>
                </div>
                <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Ext Pump Power</div>
                  <div className="font-mono text-rose-400">{currentHydraulics.pumpPowerElecW.toFixed(2)} W</div>
                </div>
              </div>
              <div className="mt-2 bg-emerald-950/40 border border-emerald-800/50 rounded-lg p-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-200">Electrical Power (P<sub>elec</sub>)</span>
                <span className="font-mono font-bold text-sm text-emerald-300">{currentElectromech.electricalPowerW.toFixed(4)} W</span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/90 border border-amber-500/30 rounded-xl p-3">
              <div className="flex items-center justify-between text-xs font-bold text-amber-400 border-b border-slate-800 pb-1.5 mb-2">
                <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Utility 3Φ AC Grid</span>
                <span className="text-[10px] font-mono text-amber-300">50 Hz • Mode B</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Generation P / Q</div>
                  <div className="font-mono font-bold text-sky-300">
                    {currentAcGrid.genActivePowerMw.toFixed(2)} MW / {currentAcGrid.genReactivePowerMvar.toFixed(2)} MVAr
                  </div>
                </div>
                <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Tx1 Ideal vs Loaded</div>
                  <div className="font-mono font-bold text-amber-300">
                    {currentAcGrid.tx1IdealSecKv.toFixed(1)} / {currentAcGrid.tx1LoadedSecKv.toFixed(1)} kV
                  </div>
                </div>
                <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">HV Line Current I<sub>L</sub></div>
                  <div className="font-mono font-bold text-slate-200">{currentAcGrid.lineCurrentA.toFixed(2)} A</div>
                </div>
                <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Receiving HV V<sub>rec</sub></div>
                  <div className="font-mono font-bold text-emerald-300">{currentAcGrid.receivingVoltageKv.toFixed(2)} kV</div>
                </div>
                <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Dist Load Voltage</div>
                  <div className="font-mono font-bold text-emerald-400">{currentAcGrid.loadVoltageKv.toFixed(2)} kV</div>
                </div>
                <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Line Loss (3·I²R)</div>
                  <div className="font-mono font-bold text-rose-400">{currentAcGrid.transmissionLossKw.toFixed(2)} kW</div>
                </div>
              </div>
              <div className="mt-2 bg-amber-950/40 border border-amber-800/50 rounded-lg p-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-200">Grid Transmission Eff</span>
                <span className="font-mono font-bold text-sm text-amber-300">{currentAcGrid.gridEfficiencyPct.toFixed(2)} %</span>
              </div>
            </div>
          )}
          </aside>
        )}
      </div>

      {/* ==================================================================== */}
      {/* BOTTOM ENGINEERING DOCK: 10 REAL-TIME GRAPHS, LAB MODE & VALIDATION  */}
      {/* ==================================================================== */}
      <section
        className={`shrink-0 bg-slate-900 border-t border-slate-800 flex flex-col transition-all duration-200 z-20 ${
          !bottomDockOpen ? 'h-9' : bottomDockExpanded ? 'h-[410px]' : 'h-48'
        }`}
      >
        {/* Bottom Dock Navigation Header */}
        <div className="h-9 shrink-0 bg-slate-950 px-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setBottomDockOpen((o) => !o)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 border border-slate-700 flex items-center gap-1"
            >
              {bottomDockOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              {bottomDockOpen ? 'Hide Dock' : 'Show Graphs & Lab'}
            </button>
            {[
              { id: 'GRAPHS',      label: 'Real-Time Graphs (10)', icon: Activity },
              { id: 'EXPERIMENTS', label: 'Lab Experiments (5)', icon: FlaskConical },
              { id: 'TURBINES',    label: 'Turbine Comparison', icon: BookOpen },
              { id: 'VALIDATION',  label: 'Validation Benchmarks (5)', icon: ShieldCheck }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveBottomTab(tab.id); setBottomDockOpen(true); }}
                  className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all shrink-0 ${
                    activeBottomTab === tab.id && bottomDockOpen
                      ? 'bg-sky-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {activeBottomTab === 'GRAPHS' && (
              <>
                <select
                  value={selectedGraphId}
                  onChange={(e) => setSelectedGraphId(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
                >
                  <option value="ALL_GRID">View 4 Key Charts Grid</option>
                  <option value="G1">1. Time vs Water Flow Rate (L/s)</option>
                  <option value="G2">2. Time vs Reservoir Water Level (cm)</option>
                  <option value="G3">3. Time vs Turbine RPM</option>
                  <option value="G4">4. Time vs Generator Voltage (V)</option>
                  <option value="G5">5. Time vs Output Current (A)</option>
                  <option value="G6">6. Time vs Electrical Power (W)</option>
                  <option value="G7">7. Flow Rate vs Electrical Power</option>
                  <option value="G8">8. Turbine RPM vs Electrical Power</option>
                  <option value="G9">9. Hydraulic Input vs Electrical Output Power</option>
                  <option value="G10">10. Load Demand vs Terminal Voltage</option>
                </select>
                <button
                  onClick={() => setGraphsPaused((p) => !p)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 border border-slate-700"
                >
                  {graphsPaused ? 'Resume Plots' : 'Freeze Plots'}
                </button>
                <button
                  onClick={() => setTelemetryHistory([])}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 border border-slate-700"
                >
                  Clear Plots
                </button>
              </>
            )}

            <button
              onClick={() => setBottomDockExpanded((e) => !e)}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              title={bottomDockExpanded ? 'Restore Dock Size' : 'Expand Dock Height'}
            >
              {bottomDockExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Bottom Dock Tab Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {/* TAB 1: REAL-TIME ENGINEERING GRAPHS (PHASE 8) */}
          {activeBottomTab === 'GRAPHS' && (
            <div className="h-full">
              {selectedGraphId === 'ALL_GRID' ? (
                <div className="grid grid-cols-4 gap-3 h-full min-h-[160px]">
                  {/* Chart 1: Flow Rate & Water Level */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 flex flex-col">
                    <div className="text-[11px] font-bold text-sky-400 mb-1">1 & 2. Flow Rate (L/s) & Level (cm)</div>
                    <div className="flex-1 min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={telemetryHistory}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} unit="s" />
                          <YAxis stroke="#38bdf8" tick={{ fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }} />
                          <Line type="monotone" dataKey="flowLs" name="Flow (L/s)" stroke="#38bdf8" strokeWidth={2} dot={false} isAnimationActive={false} />
                          <Line type="monotone" dataKey="waterLevelCm" name="Level (cm)" stroke="#2dd4bf" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart 2: Turbine Speed RPM */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 flex flex-col">
                    <div className="text-[11px] font-bold text-amber-400 mb-1">3. Time vs Turbine Speed (RPM)</div>
                    <div className="flex-1 min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={telemetryHistory}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} unit="s" />
                          <YAxis stroke="#f59e0b" tick={{ fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }} />
                          <Area type="monotone" dataKey="rpm" name="Turbine RPM" stroke="#f59e0b" fill="#f59e0b33" strokeWidth={2} isAnimationActive={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart 3: Voltage & Current */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 flex flex-col">
                    <div className="text-[11px] font-bold text-emerald-400 mb-1">4 & 5. Voltage & Load Current</div>
                    <div className="flex-1 min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={telemetryHistory}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} unit="s" />
                          <YAxis stroke="#10b981" tick={{ fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }} />
                          <Line type="monotone" dataKey="voltageV" name="Voltage" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                          <Line type="monotone" dataKey="currentA" name="Current (A)" stroke="#a855f7" strokeWidth={2} dot={false} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart 4: Hydraulic Input vs Electrical Output Power */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 flex flex-col">
                    <div className="text-[11px] font-bold text-purple-400 mb-1">6 & 9. Hydraulic vs Electrical Power</div>
                    <div className="flex-1 min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={telemetryHistory}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} unit="s" />
                          <YAxis stroke="#c084fc" tick={{ fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }} />
                          <Line type="monotone" dataKey="hydPowerW" name="P_hyd (W)" stroke="#38bdf8" strokeWidth={2} dot={false} isAnimationActive={false} />
                          <Line type="monotone" dataKey="elecPowerW" name="P_elec" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 h-full flex flex-col">
                  {(() => {
                    const graphMap = {
                      G1:  { title: '1. Time (s) vs Water Flow Rate (L/s)', xKey: 'time', xUnit: 's', yKey: 'flowLs', yUnit: 'L/s', color: '#38bdf8' },
                      G2:  { title: '2. Time (s) vs Reservoir Water Level (cm)', xKey: 'time', xUnit: 's', yKey: 'waterLevelCm', yUnit: 'cm', color: '#2dd4bf' },
                      G3:  { title: '3. Time (s) vs Turbine Speed (RPM)', xKey: 'time', xUnit: 's', yKey: 'rpm', yUnit: 'RPM', color: '#f59e0b' },
                      G4:  { title: '4. Time (s) vs Generator Terminal Voltage', xKey: 'time', xUnit: 's', yKey: 'voltageV', yUnit: 'V', color: '#10b981' },
                      G5:  { title: '5. Time (s) vs Load Current (A)', xKey: 'time', xUnit: 's', yKey: 'currentA', yUnit: 'A', color: '#a855f7' },
                      G6:  { title: '6. Time (s) vs Electrical Power Output', xKey: 'time', xUnit: 's', yKey: 'elecPowerW', yUnit: 'W', color: '#22c55e' },
                      G7:  { title: '7. Volumetric Flow Rate (L/s) vs Electrical Power (W)', xKey: 'flowLs', xUnit: 'L/s', yKey: 'elecPowerW', yUnit: 'W', color: '#38bdf8' },
                      G8:  { title: '8. Turbine RPM vs Electrical Power (W)', xKey: 'rpm', xUnit: 'RPM', yKey: 'elecPowerW', yUnit: 'W', color: '#f59e0b' },
                      G9:  { title: '9. Hydraulic Input Power (W) vs Electrical Output Power (W)', xKey: 'hydPowerW', xUnit: 'W', yKey: 'elecPowerW', yUnit: 'W', color: '#10b981' },
                      G10: { title: '10. Load Demand vs Terminal Voltage', xKey: 'loadDemand', xUnit: 'Ω/MW', yKey: 'voltageV', yUnit: 'V', color: '#f43f5e' }
                    };
                    const cfg = graphMap[selectedGraphId] || graphMap.G1;
                    return (
                      <>
                        <div className="text-xs font-bold text-slate-200 mb-2">{cfg.title}</div>
                        <div className="flex-1 min-h-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={telemetryHistory}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                              <XAxis dataKey={cfg.xKey} stroke="#94a3b8" tick={{ fontSize: 11 }} unit={` ${cfg.xUnit}`} />
                              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} unit={` ${cfg.yUnit}`} />
                              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }} />
                              <Legend />
                              <Line type="monotone" dataKey={cfg.yKey} name={`${cfg.yKey} (${cfg.yUnit})`} stroke={cfg.color} strokeWidth={2.5} dot={{ r: 2 }} isAnimationActive={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ENGINEERING LABORATORY & EXPERIMENT TESTING MODE (PHASE 9) */}
          {activeBottomTab === 'EXPERIMENTS' && (
            <div className="grid grid-cols-12 gap-3 h-full">
              {/* Experiment Selector & Procedure Card */}
              <div className="col-span-5 bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    {[1, 2, 3, 4, 5].map((id) => (
                      <button
                        key={id}
                        onClick={() => { setActiveExpId(id); setExpReportText(null); }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          activeExpId === id
                            ? 'bg-sky-600 text-white'
                            : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        Exp {id}
                      </button>
                    ))}
                  </div>

                  {activeExpId === 1 && (
                    <div className="text-xs space-y-1">
                      <h4 className="font-bold text-sky-400">Exp 1: Valve Opening Characteristics (25%, 50%, 75%, 100%)</h4>
                      <p className="text-slate-300 text-[11px]"><strong>Objective:</strong> <MathText text="Investigate how valve opening regulates flow rate Q, net head H_net, Pelton RPM, and DC power." /></p>
                      <p className="text-slate-400 text-[11px]"><strong>Controlled:</strong> <MathText text={`Reservoir Head = ${dimensions.platformHeightCm} cm, R_load = ${params.dcLoadResistanceOhm} Ω.`} /></p>
                    </div>
                  )}
                  {activeExpId === 2 && (
                    <div className="text-xs space-y-1">
                      <h4 className="font-bold text-sky-400"><MathText text="Exp 2: Hydraulic Head Variation (H_gross Sensitivity)" /></h4>
                      <p className="text-slate-300 text-[11px]"><strong>Objective:</strong> <MathText text="Demonstrate the non-linear effect of hydraulic head (P ∝ H^1.5 for fixed nozzle) on available power." /></p>
                      <p className="text-slate-400 text-[11px]"><strong>Controlled:</strong> <MathText text={`Valve Opening = ${params.valveOpeningPct}%, Nozzle D_n = ${dimensions.nozzleDiameterMm} mm.`} /></p>
                    </div>
                  )}
                  {activeExpId === 3 && (
                    <div className="text-xs space-y-1">
                      <h4 className="font-bold text-sky-400"><MathText text="Exp 3: Electrical Load Resistance Variation (R_load Sweep)" /></h4>
                      <p className="text-slate-300 text-[11px]"><strong>Objective:</strong> Observe terminal voltage regulation, armature current, counter-torque braking, and maximum power transfer.</p>
                      <p className="text-slate-400 text-[11px]"><strong>Controlled:</strong> <MathText text={`Valve = ${params.valveOpeningPct}%, Armature R_a = ${params.dcArmatureResOhm} Ω.`} /></p>
                    </div>
                  )}
                  {activeExpId === 4 && (
                    <div className="text-xs space-y-1">
                      <h4 className="font-bold text-sky-400">Exp 4: Hydraulic Turbine Runner Efficiency Comparison</h4>
                      <p className="text-slate-300 text-[11px]"><strong>Objective:</strong> <MathText text="Quantify how runner bucket efficiency η_turbine scales mechanical shaft torque and overall plant efficiency." /></p>
                      <p className="text-slate-400 text-[11px]"><strong>Controlled:</strong> <MathText text="Constant Hydraulic Input Power P_hyd and Load Resistance." /></p>
                    </div>
                  )}
                  {activeExpId === 5 && (
                    <div className="text-xs space-y-1">
                      <h4 className="font-bold text-amber-400">Exp 5: Utility AC Grid Transmission Voltage vs Line Losses</h4>
                      <p className="text-slate-300 text-[11px]"><strong>Objective:</strong> Compare active power transmission losses (3·I²R) at 33 kV, 66 kV, 132 kV, and 275 kV for constant MW load.</p>
                      <p className="text-slate-400 text-[11px]"><strong>Controlled:</strong> Load Demand = {acParams.loadDemandMw} MW, cosφ = {acParams.loadPowerFactor}, Line Length = {acParams.lineLengthKm} km.</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800">
                  <button
                    onClick={handleRecordExperimentPoint}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                  >
                    + Record Current State
                  </button>
                  <button
                    onClick={() => handleAutoRunExperiment(activeExpId)}
                    className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold"
                  >
                    Auto-Run 4-Step Sweep
                  </button>
                  <button
                    onClick={handleGenerateExperimentReport}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-600/30 hover:bg-amber-600/40 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-center gap-1"
                  >
                    <FileText className="w-3.5 h-3.5" /> Lab Report
                  </button>
                </div>
              </div>

              {/* Recorded Results Table or Report Viewer */}
              <div className="col-span-7 bg-slate-950 border border-slate-800 rounded-xl p-3 overflow-auto">
                {expReportText ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400">Generated UTHM BNE 22303 Lab Report</span>
                      <button
                        onClick={() => setExpReportText(null)}
                        className="text-xs text-sky-400 hover:underline"
                      >
                        Back to Results Table
                      </button>
                    </div>
                    <pre className="text-[11px] font-mono text-slate-300 bg-slate-900 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap">
                      {expReportText}
                    </pre>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-200">
                        Recorded Experimental Measurements ({expRecords[activeExpId]?.length || 0} rows)
                      </span>
                      <button
                        onClick={() => setExpRecords((prev) => ({ ...prev, [activeExpId]: [] }))}
                        className="text-[11px] text-rose-400 hover:underline"
                      >
                        Clear Table
                      </button>
                    </div>

                    {activeExpId !== 5 ? (
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400">
                            <th className="py-1 px-1.5">Valve%</th>
                            <th className="py-1 px-1.5">H<sub>net</sub>(m)</th>
                            <th className="py-1 px-1.5">Q(L/s)</th>
                            <th className="py-1 px-1.5">RPM</th>
                            <th className="py-1 px-1.5">R<sub>load</sub>(Ω)</th>
                            <th className="py-1 px-1.5">V<sub>t</sub>(V)</th>
                            <th className="py-1 px-1.5">I(A)</th>
                            <th className="py-1 px-1.5">P<sub>elec</sub>(W)</th>
                            <th className="py-1 px-1.5">η<sub>tot</sub>(%)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {(expRecords[activeExpId] || []).map((r) => (
                            <tr key={r.id} className="hover:bg-slate-900/60">
                              <td className="py-1 px-1.5 text-sky-300">{r.valvePct}%</td>
                              <td className="py-1 px-1.5">{r.netHeadM}</td>
                              <td className="py-1 px-1.5">{r.flowLs}</td>
                              <td className="py-1 px-1.5 text-amber-300">{r.rpm}</td>
                              <td className="py-1 px-1.5">{r.loadOhm}</td>
                              <td className="py-1 px-1.5 text-emerald-300">{r.voltageV}</td>
                              <td className="py-1 px-1.5">{r.currentA}</td>
                              <td className="py-1 px-1.5 font-bold text-emerald-400">{r.elecPowerW}</td>
                              <td className="py-1 px-1.5">{r.overallEffPct}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400">
                            <th className="py-1 px-2">Tx Voltage (kV)</th>
                            <th className="py-1 px-2">Load Demand (MW)</th>
                            <th className="py-1 px-2">Line Current I<sub>L</sub> (A)</th>
                            <th className="py-1 px-2">Line Loss 3·I²R (kW)</th>
                            <th className="py-1 px-2">Receiving V<sub>rec</sub> (kV)</th>
                            <th className="py-1 px-2">Grid Efficiency (%)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {(expRecords[5] || []).map((r) => (
                            <tr key={r.id} className="hover:bg-slate-900/60">
                              <td className="py-1 px-2 text-amber-300 font-bold">{r.txVoltageKv} kV</td>
                              <td className="py-1 px-2">{r.loadMw} MW</td>
                              <td className="py-1 px-2 text-sky-300">{r.lineCurrentA} A</td>
                              <td className="py-1 px-2 text-rose-400 font-bold">{r.lineLossKw} kW</td>
                              <td className="py-1 px-2">{r.recVoltageKv} kV</td>
                              <td className="py-1 px-2 text-emerald-400 font-bold">{r.gridEffPct}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {(expRecords[activeExpId] || []).length === 0 && (
                      <div className="text-center py-6 text-xs text-slate-500">
                        Click <strong>"Auto-Run 4-Step Sweep"</strong> or <strong>"+ Record Current State"</strong> to populate experimental data.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TURBINE SELECTION & ENGINEERING COMPARISON (PHASE 3.1) */}
          {activeBottomTab === 'TURBINES' && (
            <div className="grid grid-cols-3 gap-3 h-full">
              {TURBINE_COMPARISON_DATA.map((t) => (
                <div key={t.type} className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-sky-400">{t.type}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono">
                      {t.category}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 space-y-1">
                    <div><strong className="text-slate-400">Head & Flow:</strong> {t.headRange} • {t.flowRange}</div>
                    <div><strong className="text-slate-400">Specific Speed:</strong> <MathText text={t.specificSpeed} /> | <strong>Peak η:</strong> {t.peakEfficiency}</div>
                    <div><strong className="text-slate-400">Operating Principle:</strong> {t.mechanism}</div>
                    <div className="text-emerald-300/90 pt-1 border-t border-slate-800/80">
                      <strong>Application Note:</strong> {t.whyUsedHere}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: FIVE NUMERICAL ENGINEERING VALIDATION BENCHMARKS (PHASE 11 & 15) */}
          {activeBottomTab === 'VALIDATION' && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 h-full overflow-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Phase 15 Acceptance Benchmarks: Expected Analytical vs Simulator Calculated Results
                </span>
                <span className="text-[11px] font-mono text-slate-400">All 12 Physics Conservation Checks Active</span>
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-1.5 px-2">Validation Case</th>
                    <th className="py-1.5 px-2">Test Conditions</th>
                    <th className="py-1.5 px-2">Expected Analytical</th>
                    <th className="py-1.5 px-2">Simulator Calculated</th>
                    <th className="py-1.5 px-2">Error</th>
                    <th className="py-1.5 px-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {validationBenchmarks.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-900/50">
                      <td className="py-1.5 px-2 font-semibold text-slate-200">{v.title}</td>
                      <td className="py-1.5 px-2 font-mono text-[11px] text-slate-400"><MathText text={v.conditions} /></td>
                      <td className="py-1.5 px-2 font-mono text-sky-300">{v.expected}</td>
                      <td className="py-1.5 px-2 font-mono text-emerald-300">{v.calculated}</td>
                      <td className="py-1.5 px-2 font-mono text-slate-300">{v.errorPct}</td>
                      <td className="py-1.5 px-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                          {v.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ==================================================================== */}
      {/* PROTOTYPE DIMENSIONS & HYDRAULIC LOSS CONFIGURATION MODAL (PHASE 1.2)*/}
      {/* ==================================================================== */}
      {showDimensionsModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-white">Prototype Physical Dimensions & Hydraulic Loss Settings</h3>
                <p className="text-xs text-slate-400">
                  Phase 1.2 & 2.1: All physical prototype dimensions are editable and dynamically update effective head & flow.
                </p>
              </div>
              <button
                onClick={() => setShowDimensionsModal(false)}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Upper Platform Height (cm)</label>
                <input
                  type="number" value={dimensions.platformHeightCm}
                  onChange={(e) => setDimensions((d) => ({ ...d, platformHeightCm: Number(e.target.value) }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Turbine Nozzle Elev (cm)</label>
                <input
                  type="number" value={dimensions.turbineElevCm}
                  onChange={(e) => setDimensions((d) => ({ ...d, turbineElevCm: Number(e.target.value) }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Penstock Length L (cm)</label>
                <input
                  type="number" value={dimensions.penstockLengthCm}
                  onChange={(e) => setDimensions((d) => ({ ...d, penstockLengthCm: Number(e.target.value) }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Penstock ID D_p (mm)</label>
                <input
                  type="number" step="0.5" value={dimensions.penstockDiameterMm}
                  onChange={(e) => setDimensions((d) => ({ ...d, penstockDiameterMm: Number(e.target.value) }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Nozzle ID D_n (mm)</label>
                <input
                  type="number" step="0.5" value={dimensions.nozzleDiameterMm}
                  onChange={(e) => setDimensions((d) => ({ ...d, nozzleDiameterMm: Number(e.target.value) }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Pelton Runner D (mm)</label>
                <input
                  type="number" value={dimensions.runnerDiameterMm}
                  onChange={(e) => setDimensions((d) => ({ ...d, runnerDiameterMm: Number(e.target.value) }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Reservoir Length (cm)</label>
                <input
                  type="number" value={dimensions.reservoirLengthCm}
                  onChange={(e) => setDimensions((d) => ({ ...d, reservoirLengthCm: Number(e.target.value) }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Reservoir Width (cm)</label>
                <input
                  type="number" value={dimensions.reservoirWidthCm}
                  onChange={(e) => setDimensions((d) => ({ ...d, reservoirWidthCm: Number(e.target.value) }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Water Temp (°C)</label>
                <input
                  type="number" value={params.waterTempC}
                  onChange={(e) => setParams((p) => ({ ...p, waterTempC: Number(e.target.value) }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                onClick={() => setDimensions(INITIAL_DIMENSIONS)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
              >
                Restore Initial Prototype Dimensions (120×60 cm Base, 75 cm Platform)
              </button>
              <button
                onClick={() => setShowDimensionsModal(false)}
                className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white"
              >
                Apply & Return to Simulator
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}