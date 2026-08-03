import { button, Leva, useControls } from 'leva'
import { tuning } from '../game/tuning'
import { balance } from '../game/balance'
import type { PerfilCliente } from '../game/systems/clients'
import { clearSave } from '../game/systems/persistence'
import { useGameStore } from '../state/gameStore'
import { STEERING_SOURCES, type SteeringId } from '../game/vehicle/steering'

/**
 * Panel de ajustes en vivo. Cada control escribe directo en el objeto
 * `tuning` vía onChange (updates transitorios, sin re-renders); el juego lo
 * lee cada frame. `fillLevel` es la excepción: es estado de juego y escribe
 * al store.
 *
 * Está pensado para el pulgar, no para el mouse: filas altas, deslizadores
 * gordos, etiquetas arriba del control para que el deslizador ocupe todo el
 * ancho, y todo salvo lo esencial arranca colapsado.
 */

/** Tema para pantalla táctil: lo importante es el tamaño del agarre. */
const TEMA_TACTIL = {
  sizes: {
    rootWidth: '100%',
    controlWidth: '100%',
    numberInputMinWidth: '58px',
    // El pulgar del deslizador. Con los 8x16 de fábrica es imposible agarrarlo.
    scrubberWidth: '16px',
    scrubberHeight: '26px',
    rowHeight: '34px',
    folderTitleHeight: '38px',
    checkboxSize: '24px',
  },
  space: {
    rowGap: '10px',
    colGap: '10px',
    md: '12px',
  },
  fontSizes: {
    root: '13px',
  },
}

/** Las carpetas de detalle arrancan cerradas para que quepan en la pantalla. */
const CERRADA = { collapsed: true }

/*
 * Los números de cada perfil de cliente son la misma plantilla tres veces,
 * así que la carpeta se genera. Escriben directo en balance, igual que el
 * resto del panel escribe en tuning: el juego calcula con el valor vivo.
 */
function perfilSchema(id: PerfilCliente) {
  const p = balance.perfiles[id]
  return {
    'precio por litro': {
      value: p.sellPricePerLiter,
      min: 0.01,
      max: 0.5,
      step: 0.005,
      onChange: (n: number) => void (p.sellPricePerLiter = n),
    },
    propina: {
      value: p.tipPct,
      min: 0,
      max: 0.5,
      step: 0.01,
      onChange: (n: number) => void (p.tipPct = n),
    },
    'ventana (min)': {
      value: p.windowMinutes,
      min: 1,
      max: 20,
      step: 0.5,
      onChange: (n: number) => void (p.windowMinutes = n),
    },
    'tolerancia (×ventana)': {
      value: p.lateFactor,
      min: 1,
      max: 3,
      step: 0.05,
      onChange: (n: number) => void (p.lateFactor = n),
    },
    'pago tarde (×)': {
      value: p.latePayFactor,
      min: 0,
      max: 1,
      step: 0.05,
      onChange: (n: number) => void (p.latePayFactor = n),
    },
    'pago muy tarde (×)': {
      value: p.veryLatePayFactor,
      min: 0,
      max: 1,
      step: 0.05,
      onChange: (n: number) => void (p.veryLatePayFactor = n),
    },
    'litros mín': {
      value: p.litros.min,
      min: 100,
      max: 8000,
      step: 100,
      onChange: (n: number) => void (p.litros.min = n),
    },
    'litros máx': {
      value: p.litros.max,
      min: 100,
      max: 10000,
      step: 100,
      onChange: (n: number) => void (p.litros.max = n),
    },
    'rep a tiempo': {
      value: p.rep.onTime,
      min: 0,
      max: 10,
      step: 0.5,
      onChange: (n: number) => void (p.rep.onTime = n),
    },
    'rep tarde': {
      value: p.rep.late,
      min: -10,
      max: 0,
      step: 0.5,
      onChange: (n: number) => void (p.rep.late = n),
    },
    'rep muy tarde': {
      value: p.rep.veryLate,
      min: -15,
      max: 0,
      step: 0.5,
      onChange: (n: number) => void (p.rep.veryLate = n),
    },
  }
}

export default function TuningPanel() {
  const v = tuning.vehicle

  /*
   * Lo que se ajusta a cada rato, arriba y abierto. Estos seis controles son
   * los que se piden a mano; el resto vive en las carpetas de abajo.
   */
  useControls('esenciales', {
    // Desde Fase 1 el tanque son litros de verdad: el deslizador pasa por
    // setLiters, que sincroniza economy.liters con vehicle.fillLevel.
    'nivel del tanque': {
      value: useGameStore.getState().vehicle.fillLevel,
      min: 0,
      max: 1,
      step: 0.05,
      onChange: (n: number) =>
        useGameStore.getState().setLiters(n * balance.tank.capacity),
    },
    'velocidad máxima': {
      value: v.maxSpeed,
      min: 4,
      max: 40,
      step: 0.5,
      onChange: (n: number) => void (v.maxSpeed = n),
    },
    aceleración: {
      value: v.engineForce,
      min: 1000,
      max: 40000,
      step: 250,
      onChange: (n: number) => void (v.engineForce = n),
    },
    // Los tres del chapoteo. «Fuerza» es qué tan lejos llega el agua;
    // «rigidez» qué tan rápido regresa, así que BAJA da más retraso; e
    // «inercia» es la amortiguación, y baja la deja meciéndose más tiempo.
    'agua · fuerza': {
      value: tuning.slosh.response,
      min: 0,
      max: 0.3,
      step: 0.005,
      onChange: (n: number) => void (tuning.slosh.response = n),
    },
    'agua · rigidez (baja = más retraso)': {
      value: tuning.slosh.stiffness,
      min: 0.5,
      max: 30,
      step: 0.5,
      onChange: (n: number) => void (tuning.slosh.stiffness = n),
    },
    'agua · inercia (baja = se mece más)': {
      value: tuning.slosh.damping,
      min: 0,
      max: 12,
      step: 0.1,
      onChange: (n: number) => void (tuning.slosh.damping = n),
    },
  })

  useControls(
    'economía',
    {
      'capacidad (L)': {
        value: balance.tank.capacity,
        min: 1000,
        max: 40000,
        step: 500,
        onChange: (n: number) => void (balance.tank.capacity = n),
      },
      'compra por litro': {
        value: balance.pozo.pricePerLiter,
        min: 0.005,
        max: 0.3,
        step: 0.005,
        onChange: (n: number) => void (balance.pozo.pricePerLiter = n),
      },
      'carga (L/s)': {
        value: balance.pozo.litersPerSecond,
        min: 30,
        max: 600,
        step: 10,
        onChange: (n: number) => void (balance.pozo.litersPerSecond = n),
      },
      'radio se abre en': {
        value: balance.reputacion.radioUnlock,
        min: 50,
        max: 100,
        step: 1,
        onChange: (n: number) => void (balance.reputacion.radioUnlock = n),
      },
      'jornada (min)': {
        value: balance.jornada.minutosReales,
        min: 5,
        max: 30,
        step: 1,
        onChange: (n: number) => void (balance.jornada.minutosReales = n),
      },
      'rep minijuego limpio': {
        value: balance.reputacion.minijuegoLimpio,
        min: 0,
        max: 5,
        step: 0.5,
        onChange: (n: number) => void (balance.reputacion.minijuegoLimpio = n),
      },
      'rep derrame': {
        value: balance.reputacion.derrame,
        min: -10,
        max: 0,
        step: 0.5,
        onChange: (n: number) => void (balance.reputacion.derrame = n),
      },
      'rep cancelación': {
        value: balance.reputacion.cancelacion,
        min: -20,
        max: 0,
        step: 0.5,
        onChange: (n: number) => void (balance.reputacion.cancelacion = n),
      },
      // Para probar el Paso 1 desde el teléfono: borra y arranca de cero.
      'borrar guardado y reiniciar': button(() => {
        clearSave()
        location.reload()
      }),
    },
    CERRADA,
  )

  useControls('economía · paciente', perfilSchema('paciente'), CERRADA)
  useControls('economía · normal', perfilSchema('normal'), CERRADA)
  useControls('economía · exigente', perfilSchema('exigente'), CERRADA)

  useControls(
    'pipa · segunda',
    {
      minSpeed: {
        value: v.boost.minSpeed,
        min: 0,
        max: 16,
        step: 0.5,
        onChange: (n: number) => void (v.boost.minSpeed = n),
      },
      maxSteerDeg: {
        value: v.boost.maxSteerDeg,
        min: 0,
        max: 25,
        step: 0.5,
        onChange: (n: number) => void (v.boost.maxSteerDeg = n),
      },
      forceMultiplier: {
        value: v.boost.forceMultiplier,
        min: 1,
        max: 4,
        step: 0.05,
        onChange: (n: number) => void (v.boost.forceMultiplier = n),
      },
      maxSpeedBonus: {
        value: v.boost.maxSpeedBonus,
        min: 0,
        max: 20,
        step: 0.5,
        onChange: (n: number) => void (v.boost.maxSpeedBonus = n),
      },
      heatRate: {
        value: v.boost.heatRate,
        min: 0.02,
        max: 1.5,
        step: 0.01,
        onChange: (n: number) => void (v.boost.heatRate = n),
      },
      coolRate: {
        value: v.boost.coolRate,
        min: 0.02,
        max: 1.5,
        step: 0.01,
        onChange: (n: number) => void (v.boost.coolRate = n),
      },
      resumeTemp: {
        value: v.boost.resumeTemp,
        min: 0,
        max: 0.95,
        step: 0.05,
        onChange: (n: number) => void (v.boost.resumeTemp = n),
      },
      overheatPower: {
        value: v.boost.overheatPower,
        min: 0.05,
        max: 1,
        step: 0.05,
        onChange: (n: number) => void (v.boost.overheatPower = n),
      },
    },
    CERRADA,
  )

  useControls(
    'pipa · chapoteo',
    {
      // Red de seguridad, no perilla: si se alcanza en una maniobra normal,
      // el agua satura y los niveles del medio se sienten iguales.
      maxOffset: {
        value: tuning.slosh.maxOffset,
        min: 0.1,
        max: 2,
        step: 0.05,
        onChange: (n: number) => void (tuning.slosh.maxOffset = n),
      },
    },
    CERRADA,
  )

  useControls(
    'pipa · manejo',
    {
      // El desplegable se arma solo desde el registro: cuando entren el
      // giroscopio y el joystick horizontal aparecen aquí sin tocar nada.
      volante: {
        value: useGameStore.getState().steeringId,
        options: Object.fromEntries(
          STEERING_SOURCES.map((s) => [s.label, s.id]),
        ) as Record<string, SteeringId>,
        onChange: (id: SteeringId) => useGameStore.getState().setSteeringId(id),
      },
      tareMass: {
        value: v.tareMass,
        min: 1000,
        max: 16000,
        step: 250,
        onChange: (n: number) => void (v.tareMass = n),
      },
      waterMass: {
        value: v.waterMass,
        min: 0,
        max: 16000,
        step: 250,
        onChange: (n: number) => void (v.waterMass = n),
      },
      comY: {
        value: v.comY,
        min: -2,
        max: 1,
        step: 0.05,
        onChange: (n: number) => void (v.comY = n),
      },
      // Ojo: brakeForce y engineBrake son IMPULSOS, no newtons como
      // engineForce. Por eso los rangos son dos órdenes de magnitud menores.
      brakeForce: {
        value: v.brakeForce,
        min: 50,
        max: 2000,
        step: 10,
        onChange: (n: number) => void (v.brakeForce = n),
      },
      engineBrake: {
        value: v.engineBrake,
        min: 0,
        max: 600,
        step: 5,
        onChange: (n: number) => void (v.engineBrake = n),
      },
      frictionSlip: {
        value: v.frictionSlip,
        min: 0.5,
        max: 12,
        step: 0.1,
        onChange: (n: number) => void (v.frictionSlip = n),
      },
      sideFrictionStiffness: {
        value: v.sideFrictionStiffness,
        min: 0.1,
        max: 4,
        step: 0.05,
        onChange: (n: number) => void (v.sideFrictionStiffness = n),
      },
      angularDamping: {
        value: v.angularDamping,
        min: 0,
        max: 4,
        step: 0.05,
        onChange: (n: number) => void (v.angularDamping = n),
      },
    },
    CERRADA,
  )

  useControls(
    'pipa · volante',
    {
      maxDeg: {
        value: v.steer.maxDeg,
        min: 5,
        max: 45,
        step: 1,
        onChange: (n: number) => void (v.steer.maxDeg = n),
      },
      speedFalloff: {
        value: v.steer.speedFalloff,
        min: 0.05,
        max: 1,
        step: 0.05,
        onChange: (n: number) => void (v.steer.speedFalloff = n),
      },
      speed: {
        value: v.steer.speed,
        min: 0.2,
        max: 6,
        step: 0.1,
        onChange: (n: number) => void (v.steer.speed = n),
      },
      returnSpeed: {
        value: v.steer.returnSpeed,
        min: 0.2,
        max: 8,
        step: 0.1,
        onChange: (n: number) => void (v.steer.returnSpeed = n),
      },
    },
    CERRADA,
  )

  useControls(
    'pipa · suspensión',
    {
      stiffness: {
        value: v.suspension.stiffness,
        min: 5,
        max: 120,
        step: 1,
        onChange: (n: number) => void (v.suspension.stiffness = n),
      },
      compression: {
        value: v.suspension.compression,
        min: 0,
        max: 6,
        step: 0.1,
        onChange: (n: number) => void (v.suspension.compression = n),
      },
      relaxation: {
        value: v.suspension.relaxation,
        min: 0,
        max: 8,
        step: 0.1,
        onChange: (n: number) => void (v.suspension.relaxation = n),
      },
      restLength: {
        value: v.suspension.restLength,
        min: 0.1,
        max: 1.2,
        step: 0.05,
        onChange: (n: number) => void (v.suspension.restLength = n),
      },
      maxForce: {
        value: v.suspension.maxForce,
        min: 10000,
        max: 400000,
        step: 5000,
        onChange: (n: number) => void (v.suspension.maxForce = n),
      },
      maxTravel: {
        value: v.suspension.maxTravel,
        min: 0.05,
        max: 1,
        step: 0.05,
        onChange: (n: number) => void (v.suspension.maxTravel = n),
      },
    },
    CERRADA,
  )

  useControls(
    'interacción',
    {
      boardRadius: {
        value: tuning.interaction.boardRadius,
        min: 1,
        max: 10,
        step: 0.25,
        onChange: (n: number) => void (tuning.interaction.boardRadius = n),
      },
      localRadius: {
        value: tuning.interaction.localRadius,
        min: 1,
        max: 12,
        step: 0.25,
        onChange: (n: number) => void (tuning.interaction.localRadius = n),
      },
      exitSpeed: {
        value: tuning.interaction.exitSpeed,
        min: 0.05,
        max: 3,
        step: 0.05,
        onChange: (n: number) => void (tuning.interaction.exitSpeed = n),
      },
      modeTransition: {
        value: tuning.camera.modeTransition,
        min: 0.1,
        max: 2,
        step: 0.05,
        onChange: (n: number) => void (tuning.camera.modeTransition = n),
      },
    },
    CERRADA,
  )

  useControls(
    'cámara',
    {
      distance: {
        value: tuning.camera.distance,
        min: 2,
        max: 15,
        step: 0.25,
        onChange: (n: number) => void (tuning.camera.distance = n),
      },
      height: {
        value: tuning.camera.height,
        min: 0.5,
        max: 3,
        step: 0.1,
        onChange: (n: number) => void (tuning.camera.height = n),
      },
      followLerp: {
        value: tuning.camera.followLerp,
        min: 1,
        max: 25,
        step: 0.5,
        onChange: (n: number) => void (tuning.camera.followLerp = n),
      },
      sensitivity: {
        value: tuning.camera.sensitivity,
        min: 0.001,
        max: 0.02,
        step: 0.0005,
        onChange: (n: number) => void (tuning.camera.sensitivity = n),
      },
      minPitch: {
        value: tuning.camera.minPitch,
        min: -60,
        max: 0,
        step: 1,
        onChange: (n: number) => void (tuning.camera.minPitch = n),
      },
      maxPitch: {
        value: tuning.camera.maxPitch,
        min: 10,
        max: 85,
        step: 1,
        onChange: (n: number) => void (tuning.camera.maxPitch = n),
      },
      minDistance: {
        value: tuning.camera.minDistance,
        min: 0.5,
        max: 4,
        step: 0.1,
        onChange: (n: number) => void (tuning.camera.minDistance = n),
      },
      collisionRadius: {
        value: tuning.camera.collisionRadius,
        min: 0.1,
        max: 1,
        step: 0.05,
        onChange: (n: number) => void (tuning.camera.collisionRadius = n),
      },
      returnLerp: {
        value: tuning.camera.returnLerp,
        min: 0.5,
        max: 15,
        step: 0.5,
        onChange: (n: number) => void (tuning.camera.returnLerp = n),
      },
      fovFoot: {
        value: tuning.camera.fovFoot,
        min: 50,
        max: 95,
        step: 1,
        onChange: (n: number) => void (tuning.camera.fovFoot = n),
      },
      fovDrive: {
        value: tuning.camera.fovDrive,
        min: 50,
        max: 95,
        step: 1,
        onChange: (n: number) => void (tuning.camera.fovDrive = n),
      },
      driveDistance: {
        value: tuning.camera.driveDistance,
        min: 4,
        max: 25,
        step: 0.5,
        onChange: (n: number) => void (tuning.camera.driveDistance = n),
      },
      driveHeight: {
        value: tuning.camera.driveHeight,
        min: 0.5,
        max: 8,
        step: 0.1,
        onChange: (n: number) => void (tuning.camera.driveHeight = n),
      },
      driveRecenter: {
        value: tuning.camera.driveRecenter,
        min: 0,
        max: 8,
        step: 0.1,
        onChange: (n: number) => void (tuning.camera.driveRecenter = n),
      },
    },
    CERRADA,
  )

  useControls(
    'jugador',
    {
      walkSpeed: {
        value: tuning.player.walkSpeed,
        min: 1,
        max: 12,
        step: 0.1,
        onChange: (n: number) => void (tuning.player.walkSpeed = n),
      },
      runSpeed: {
        value: tuning.player.runSpeed,
        min: 1,
        max: 15,
        step: 0.1,
        onChange: (n: number) => void (tuning.player.runSpeed = n),
      },
      accel: {
        value: tuning.player.accel,
        min: 1,
        max: 40,
        step: 0.5,
        onChange: (n: number) => void (tuning.player.accel = n),
      },
      decel: {
        value: tuning.player.decel,
        min: 1,
        max: 40,
        step: 0.5,
        onChange: (n: number) => void (tuning.player.decel = n),
      },
      turnSpeed: {
        value: tuning.player.turnSpeed,
        min: 1,
        max: 30,
        step: 0.5,
        onChange: (n: number) => void (tuning.player.turnSpeed = n),
      },
      gravity: {
        value: tuning.player.gravity,
        min: 5,
        max: 50,
        step: 0.5,
        onChange: (n: number) => void (tuning.player.gravity = n),
      },
      staminaDrain: {
        value: tuning.player.staminaDrain,
        min: 0.05,
        max: 1,
        step: 0.01,
        onChange: (n: number) => void (tuning.player.staminaDrain = n),
      },
      staminaRegen: {
        value: tuning.player.staminaRegen,
        min: 0.05,
        max: 1,
        step: 0.01,
        onChange: (n: number) => void (tuning.player.staminaRegen = n),
      },
    },
    CERRADA,
  )

  return (
    <Leva
      // fill: ocupa el contenedor que le da TuningDrawer, en vez de plantarse
      // en la esquina con un ancho fijo pensado para escritorio.
      fill
      flat
      titleBar={false}
      oneLineLabels
      theme={TEMA_TACTIL}
    />
  )
}
