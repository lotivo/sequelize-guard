# TODO

List of some major tasks to do.

## A. API Changes

### A.1 Multiple Roles during assigning roles
  
  **currently** you can do as following:

  ```acl.assignRoles(user, ['superadmin','admin'])```

  ```acl.assignRoles(user, 'superadmin')```

  **desired** : pass multiple roles

  ```js
    acl.assignRoles([user, user2], ['superadmin','admin'])
  ```

  ```js
    acl.assignRoles([
      {
        user : user,
        role : 'superadmin'
      },{
        user : user2,
        role : 'admin'
      }
    ])
  ```

## D. Database/ Structural Changes

### D.1 Make Role & Permission Model Polymorphic

- Polymorphic relationship with role dso than, Any model can have roles.
- If possible (not sure) make permission polymorphic too.

  e.g. If we give role "commentable" to Post, and "Commentable" role has permission to "have comments"
  then we can check.

  ```BlogPost.can('have comments').```
