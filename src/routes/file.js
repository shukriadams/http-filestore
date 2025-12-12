module.exports = express => {

    const fs = require('fs-extra'),
        path = require('path'),
        settings = require('./../lib/settings'),
        { pipeline } = require('stream/promises')

/*

bucket: 
    name
    secret
*/


    express.get('/file/:bucket/:path(*)', async (req, res) => {
        try {
            // ensure that bucket is allowed
            const bucket = req.params.bucket,
                bucketConfig = settings.buckets[bucket]

            if (!bucketConfig)
                return res.end('bucket not defined')                
            
            // if bucket defines key, ensure key has been passed in header 
            if (bucketConfig.secret){
                let authPassed = false
                const header = req.headers.authorization || ''
                if (header){
                    const token = header.split(/\s+/).pop() || ''
                    if (token){
                        const tokenDecoded = Buffer.from(token, 'base64').toString()
                        if (token === bucketConfig.secret || tokenDecoded === bucketConfig.secret)
                            authPassed = true
                            
                    }
                }

                if (!authPassed)
                    return res.end('auth fail')
            }

            // fail if file doesnt exist > make 404
            const storePath = path.join(settings.store, bucket, req.params.path)
            if (!await fs.exists(storePath))
                return res.end('file not found')

            // set default mime type
            let mimeType = 'application/octet-stream'

            // try to find a better mime type if bucket supports it and file type can be mapped
            let extension = path.extname(storePath)
            if (extension && extension.startsWith('.'))
                extension = extension.substr(1)

            if (extension)
                for (let def of Object.keys(settings.mimeTypes))
                    if (def && def.includes(`${extension}|`))
                        mimeType = settings.mimeTypes[def]

            res.setHeader('content-type', mimeType)
            fs.createReadStream(storePath).pipe(res)
            
        } catch(ex){
            res.end(ex)
            console.log(ex)
        }
    })


    /**
     * 
     */
    express.post('/file/:bucket/:path(*)', async (req, res) => {
        try {

            if (!req.body)
                throw `body not set`

            // ensure that bucket is allowed
            const bucket = req.params.bucket,
                bucketConfig = settings.buckets[bucket]

            if (!bucketConfig)
                return res.end(`bucket ${bucket} not defined`)
            
            // if bucket defines key, ensure key has been passed in header 
            if (bucketConfig.secret){
                let authPassed = false
                const header = req.headers.authorization || ''
                if (header){
                    const token = header.split(/\s+/).pop() || ''
                    if (token){
                        const tokenDecoded = Buffer.from(token, 'base64').toString()
                        if (token === bucketConfig.secret || tokenDecoded === bucketConfig.secret)
                            authPassed = true
                            
                    }
                }

                if (!authPassed)
                    return res.end('auth fail')
            }

            // fail if file exists
            const storePath = path.join(settings.store, bucket, req.params.path)
            if (await fs.exists(storePath))
                return res.end('file exists')

            const directoryPath = path.dirname(storePath)

            try {
                await fs.mkdir(directoryPath, { recursive: true })
            } 
            catch (ex) {
                if (ex.code && ex.code === 'EEXIST'){
                    res.status(400)
                    return res.end('cannot create requested path, likely because it collides with existing file')
                } else
                    throw ex
            }

            
            //req.pipe(fs.createWriteStream(storePath, {flags:'a'})) 
            //res.end('file written')
            
            // Use pipeline instead of .pipe() for error handling
            // and automatic stream cleanup on failure
            try {
                await pipeline(
                    req,
                    fs.createWriteStream(storePath, { flags: "a" }),
                );
                res.end("file written");
            } catch (err) {
                console.error(err);
                res.status(500).end(err.message);
            }

        } catch(ex){
            res.end(JSON.stringify(ex))
            console.log(ex)
        }
    })

    /**
     * 
     */
    express.delete('/file/:bucket/:path(*)', async (req, res) => {
        try {

            // ensure that bucket is allowed
            const bucket = req.params.bucket,
                bucketConfig = settings.buckets[bucket]

            if (!bucketConfig)
                return res.end(`bucket ${bucket} not defined`)
            
            // if bucket defines key, ensure key has been passed in header 
            if (bucketConfig.secret){
                let authPassed = false
                const header = req.headers.authorization || ''
                if (header){
                    const token = header.split(/\s+/).pop() || ''
                    if (token){
                        const tokenDecoded = Buffer.from(token, 'base64').toString()
                        if (token === bucketConfig.secret || tokenDecoded === bucketConfig.secret)
                            authPassed = true
                            
                    }
                }

                if (!authPassed)
                    return res.end('auth fail')
            }

            // exit if file exists
            const storePath = path.join(settings.store, bucket, req.params.path)
            if (!await fs.exists(storePath)){
                res.status(404)
                return res.end('file not found')
            }

            await fs.remove(storePath)

            res.end('file deleted')

        } catch(ex){
            res.end(ex)
            console.log(ex)
        }
    })
    
}