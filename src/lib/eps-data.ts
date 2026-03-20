/**
 * @fileOverview Mapa de correos electrónicos de las EPS.
 * 
 * Este archivo contiene un objeto que mapea nombres normalizados de Entidades Promotoras de Salud (EPS)
 * a sus respectivas direcciones de correo electrónico para autorizaciones.
 * 
 * Instrucción: Rellena este objeto con los datos reales de las EPS con las que trabajas.
 * La clave debe ser una versión simplificada y en minúsculas del nombre de la EPS
 * (ej. 'cajacopi', 'nuevaeps', 'sura') para asegurar una coincidencia robusta.
 */

export const epsEmailMap: Record<string, string> = {
    // --- EJEMPLOS ---
    // Reemplaza o añade las EPS reales y sus correos electrónicos
    'cajacopi': 'cordoba.auditor@cajacopieps.com,cordoba.auditor1@cajacopieps.com,apoyo.diagnostico@cajacopieps.co,csscoordinacionmedica@gmail.com',
    'nuevaeps': 'autorizaciones.nacional@nuevaeps.com.co',
    'sura': 'autorizaciones@sura.com.co',
    'sanitas': 'autorizaciones@sanitas.com',
    'compensar': 'autorizaciones@compensar.com',

    // --- EPS REALES (Añade aquí las que necesites) ---
    // 'nombreeps': 'correo@real.com',
    
};
