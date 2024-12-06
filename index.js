require('dotenv').config(); // Cargar las variables de entorno
const fastify = require('fastify')();
const formbody = require('@fastify/formbody');
const nodemailer = require('nodemailer');
const mysql = require('mysql2/promise'); // Importar mysql2 como promesa

// Configura el pool de conexiones a la base de datos
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,         // Usar variable de entorno
  password: process.env.DB_PASSWORD, // Usar variable de entorno
  database: process.env.DB_NAME      // Usar variable de entorno
});

// Configura Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Tu dirección de correo electrónico de Gmail
    pass: process.env.EMAIL_PASSWORD,   // Tu contraseña de Gmail o contraseña de aplicación
  },
});

// Ruta para recibir el registro
fastify.post('/register', async (request, reply) => {
  const { email } = request.body;

  if (!email) {
    return reply.status(400).send('El correo electrónico es requerido.');
  }

  let connection;

  try {
    connection = await pool.getConnection(); // Obtiene una conexión del pool

    // Inserta el correo electrónico en la base de datos
    const [results] = await connection.query('INSERT INTO suscriptores (email) VALUES (?)', [email]);

    // Envía un correo electrónico de bienvenida
    const mailOptions = {
      from: process.env.EMAIL_USER,      // Usar variable de entorno
      to: email,
      subject: 'Bienvenido a Lumina',
      text: 'Gracias por registrarte en Lumina. ¡Estamos felices de tenerte con nosotros!'
    };

    await transporter.sendMail(mailOptions); // Enviar el correo de manera asíncrona

    // Redirige a la página deseada después de un registro exitoso
    reply.redirect('https://kostasense.github.io/Lumina/registro.html'); // Cambia esta URL a la página deseada
  } catch (error) {
    console.error('Error al procesar la solicitud: ', error);
    reply.status(500).send('Error al almacenar el correo electrónico o al enviar el correo.');
  } finally {
    if (connection) connection.release(); // Libera la conexión de nuevo al pool
  }
});

fastify.register(formbody);

// Ruta para redirigir a la página de registro
fastify.get('/register', (request, reply) => {
  reply.redirect('https://kostasense.github.io/Lumina/registro.html');
});

// Iniciar el servidor
fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error('Error al iniciar el servidor: ', err);
    process.exit(1);
  }
  console.log('Servidor en funcionamiento');
});

// Nueva ruta para enviar un correo a todos los suscriptores
fastify.post('/send-email-to-subscribers', async (request, reply) => {
  let connection;

  try {
    connection = await pool.getConnection(); // Obtener una conexión de la base de datos

    // Obtener todos los correos electrónicos de los suscriptores
    const [rows] = await connection.query('SELECT email FROM suscriptores');

    // Verificar si hay suscriptores
    if (rows.length === 0) {
      return reply.status(404).send('No hay suscriptores.');
    }

    // Definir las opciones del correo
    const mailOptions = {
      from: process.env.EMAIL_USER,
      subject: 'Nueva actualización de Lumina',
      html:`
      <h1>¡Tenemos novedades! Revisa lo más reciente de Lumina.</h1>
      <img src="https://raw.githubusercontent.com/kostasense/Lumina/refs/heads/main/imagenes/gatoloco.jpg" alt="gatoloco"/>
      `
    };

    // Enviar un correo a cada suscriptor
    for (const row of rows) {
      mailOptions.to = row.email; // Asignar cada correo electrónico

      await transporter.sendMail(mailOptions); // Enviar el correo
    }

    reply.send('Correos electrónicos enviados a todos los suscriptores.');
  } catch (error) {
    console.error('Error al enviar correos a los suscriptores: ', error);
    reply.status(500).send('Error al enviar los correos.');
  } finally {
    if (connection) connection.release(); // Liberar la conexión de nuevo al pool
  }
});
