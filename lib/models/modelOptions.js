module.exports = function(options){
    return{
        underscored: true,
        timestamps: options.timestamps,
        paranoid: options.timestamps && options.paranoid,
        defaultScope: {
            attributes: { exclude: ['createdAt','updatedAt','deletedAt'] },
        },
        scopes: {
            withTimestamps: {
                attributes: { include: ['createdAt','updatedAt','deletedAt'] },
            }
        }
    }
}
