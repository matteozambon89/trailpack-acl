'use strict'

const Policy = require('trails-policy')
const _ = require('lodash')

/**
 * @module CheckPermissionsPolicy
 * @description Check permission on the route or model
 */
module.exports = class CheckPermissionsPolicy extends Policy {
  checkModel(req, res, next) {
    const modelName = req.params.model
    const user = req.user
    const defaultRole = this.app.config.permissions.defaultRole

    let action = 'access'
    if (req.method === 'POST') {
      action = 'create'
    }
    else if (req.method === 'PUT' || req.method === 'PATCH') {
      action = 'update'
    }
    else if (req.method === 'DELETE') {
      action = 'destroy'
    }

    if (user) {
      this.app.services.PermissionService.isUserAllowed(user, modelName, action).then(permission => {
        if (!permission || permission.length === 0) {
          res.forbidden(`You doesn't have permissions to ${action} ${modelName}`)
        }
        else {
          if (action !== 'create' && permission[0].Resource.checkOwners === true) {
            if (action === 'access' || !req.params.id) {

              next()//FIXME add where filter to the request to manage only owners items
            }
            else {
              this.app.services.FootprintService.find(modelName, req.params.id, {populate: 'owners'}).then(items => {
                for (let i = 0; i < items.owners.length; i++) {
                  if (items.owners[i].id === user.id) {
                    return next()
                  }
                }
                res.forbidden(`You doesn't have permissions to ${action} ${modelName}:${req.params.id}`)
              }).catch(err => {
                this.app.log.error(err)
                res.serverError(err)
              })
            }
          }
          else {
            next()
          }
        }
      }).catch(next)
    }
    else if (defaultRole) {
      this.app.services.PermissionService.isAllowed(defaultRole, modelName, action).then(permission => {
        if (!permission || permission.length === 0) {
          res.forbidden(`You doesn't have permissions to ${action} ${modelName}`)
        }
        else {
          next()
        }
      }).catch(next)
    }
    else {
      res.forbidden(`You doesn't have permissions to ${action} ${modelName}`)
    }
  }

  checkRoute(req, res, next) {
    const user = req.user
    const defaultRole = this.app.config.permissions.defaultRole

    const permissionsConfig = _.get(req.route, 'config.app.permissions')

    if (!permissionsConfig) return next()

    if (user) {
      this.app.services.PermissionService.isUserAllowed(user, permissionsConfig.resourceName, 'access').then(permission => {
        if (!permission || permission.length === 0) {
          res.forbidden(`You doesn't have permissions to access ${req.originalUrl}`)
        }
        else {
          next()
        }
      }).catch(next)
    }
    else if (defaultRole) {
      this.app.services.PermissionService.isAllowed(defaultRole, permissionsConfig.resourceName, 'access').then(permission => {
        if (!permission || permission.length === 0) {
          res.forbidden(`You doesn't have permissions to access ${req.originalUrl}`)
        }
        else {
          next()
        }
      }).catch(next)
    }
    else {
      res.forbidden(`You doesn't have permissions to access ${req.originalUrl}`)
    }

  }
}

