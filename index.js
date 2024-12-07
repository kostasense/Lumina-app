require('dotenv').config(); // Cargar las variables de entorno
const fastify = require('fastify')();
const fastifyCors = require('@fastify/cors');

const fastifyJWT = require('@fastify/jwt'); // Importar fastify-jwt
fastify.register(fastifyCors, {
  origin: '*',  // Permite solicitudes desde cualquier origen, si es necesario.
});

const formbody = require('@fastify/formbody');
fastify.register(formbody);

const { MongoClient } = require('mongodb'); // Importar MongoDB
const nodemailer = require('nodemailer');

// Configura MongoDB
const client = new MongoClient(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  tls: true, // Habilitar TLS/SSL
  tlsAllowInvalidCertificates: true, // Permitir certificados no válidos (si es necesario)
});

let db;
client.connect()
  .then(() => {
    db = client.db(process.env.DB_NAME); // Selecciona la base de datos
    console.log('Conectado a MongoDB');
  })
  .catch((error) => {
    console.error('Error al conectar a MongoDB: ', error);
  });

// Configura Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Configurar Fastify para usar JWT
fastify.register(fastifyJWT, {
  secret: process.env.JWT_SECRET, // Usar la clave secreta del JWT desde las variables de entorno
});

// Middleware para verificar el JWT
async function verifyJWT(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send('No autorizado');
  }
}

// Ruta de login para obtener el token JWT
fastify.post('/login', async (request, reply) => {
  const { username, password } = request.body;

  // Verificar las credenciales (esto debe hacerse con seguridad, posiblemente contra una base de datos)
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASSWORD) {
    const token = fastify.jwt.sign({ username, role: 'admin' }); // Añadir rol como admin
    reply.send({ token });
  } else {
    reply.status(401).send('Credenciales incorrectas');
  }
});

// Ruta para recibir el registro
fastify.post('/register', async (request, reply) => {
  const { email } = request.body;

  if (!email) {
    return reply.status(400).send('El correo electrónico es requerido.');
  }

  try {
    // Inserta el correo electrónico en la base de datos
    const collection = db.collection('suscriptores');
    await collection.insertOne({ email });

    // Envía un correo electrónico de bienvenida
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Bienvenido a Lumina',
      text: 'Gracias por registrarte en Lumina. ¡Estamos felices de tenerte con nosotros!',
    };

    await transporter.sendMail(mailOptions);

    // Redirige a la página deseada después de un registro exitoso
    reply.redirect('https://kostasense.github.io/Lumina/registro.html');
  } catch (error) {
    console.error('Error al procesar la solicitud: ', error);
    reply.status(500).send('Error al almacenar el correo electrónico o al enviar el correo.');
  }
});

// Ruta protegida para enviar un correo a todos los suscriptores
fastify.post('/send-email-to-subscribers', { preHandler: verifyJWT }, async (request, reply) => {
  try {
    const collection = db.collection('suscriptores');

    // Obtener todos los correos electrónicos de los suscriptores
    const suscriptores = await collection.find().toArray();

    if (suscriptores.length === 0) {
      return reply.status(404).send('No hay suscriptores.');
    }

    // Definir las opciones del correo
    const mailOptions = {
      from: process.env.EMAIL_USER,
      subject: 'Nueva actualización de Lumina',
      html: `
      <h1>¡Tenemos novedades! Revisa lo más reciente de Lumina.</h1>
      <img src="https://raw.githubusercontent.com/kostasense/Lumina/refs/heads/main/imagenes/gatoloco.jpg" alt="gatoloco"/>
      `,
    };

    // Enviar un correo a cada suscriptor
    for (const suscriptor of suscriptores) {
      mailOptions.to = suscriptor.email; // Asignar cada correo electrónico
      await transporter.sendMail(mailOptions);
    }

    reply.send('Correos electrónicos enviados a todos los suscriptores.');
  } catch (error) {
    console.error('Error al enviar correos a los suscriptores: ', error);
    reply.status(500).send('Error al enviar los correos.');
  }
});

// Iniciar el servidor
fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error('Error al iniciar el servidor: ', err);
    process.exit(1);
  }
  console.log('Servidor en funcionamiento');
});
