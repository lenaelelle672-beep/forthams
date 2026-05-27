package com.ams.datascope;

import com.ams.entity.Role;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.RoleMapper;
import com.ams.mapper.SysRoleDeptMapper;
import com.ams.security.LoginUser;
import com.baomidou.mybatisplus.extension.plugins.handler.MultiDataPermissionHandler;
import net.sf.jsqlparser.expression.Expression;
import net.sf.jsqlparser.expression.LongValue;
import net.sf.jsqlparser.expression.operators.relational.EqualsTo;
import net.sf.jsqlparser.expression.operators.relational.ExpressionList;
import net.sf.jsqlparser.expression.operators.relational.InExpression;
import net.sf.jsqlparser.schema.Column;
import net.sf.jsqlparser.schema.Table;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Set;

public class AmsDataPermissionHandler implements MultiDataPermissionHandler {

    private static final Logger log = LoggerFactory.getLogger(AmsDataPermissionHandler.class);

    private final DataScopeDecisionService decisionService;
    private final DataScopeTableRegistry tableRegistry;
    private final ObjectProvider<DeptMapper> deptMapper;
    private final ObjectProvider<RoleMapper> roleMapper;
    private final ObjectProvider<SysRoleDeptMapper> sysRoleDeptMapper;

    public AmsDataPermissionHandler(DataScopeDecisionService decisionService,
                                    DataScopeTableRegistry tableRegistry,
                                    ObjectProvider<DeptMapper> deptMapper,
                                    ObjectProvider<RoleMapper> roleMapper,
                                    ObjectProvider<SysRoleDeptMapper> sysRoleDeptMapper) {
        this.decisionService = decisionService;
        this.tableRegistry = tableRegistry;
        this.deptMapper = deptMapper;
        this.roleMapper = roleMapper;
        this.sysRoleDeptMapper = sysRoleDeptMapper;
    }

    @Override
    public Expression getSqlSegment(Table table, Expression where, String mappedStatementId) {
        LoginUser loginUser = getLoginUser();
        if (loginUser == null) return null;

        DataScopeMeta meta = DataScopeContextHolder.get();
        if (meta != null && !meta.isEnabled()) return null;

        String tableName = table.getName();
        DataScopeTableRegistry.FieldMapping mapping = tableRegistry.get(tableName);
        if (mapping == null) return null;

        String deptCol = meta != null && meta.getDeptColumn() != null ? meta.getDeptColumn() : mapping.deptColumn();
        String userCol = meta != null && meta.getUserColumn() != null ? meta.getUserColumn() : mapping.userColumn();

        List<Role> roles = roleMapper.getObject().selectRolesByUserId(loginUser.getUserId());
        Set<Long> customDeptIds = hasCustomDataScope(roles)
                ? sysRoleDeptMapper.getObject().selectDeptIdsByUserId(loginUser.getUserId())
                : Set.of();

        DataScopeResult result = decisionService.decide(loginUser, roles, customDeptIds);
        if (!result.isEnabled()) return null;

        return buildExpression(tableName, result, deptCol, userCol, loginUser);
    }

    private Expression buildExpression(String tableName, DataScopeResult result,
                                        String deptCol, String userCol, LoginUser loginUser) {
        DataScopeType type = result.getType();

        switch (type) {
            case SELF_ONLY:
                if (userCol != null) {
                    return new EqualsTo(new Column(tableName + "." + userCol),
                            new LongValue(loginUser.getUserId()));
                }
                return null;

            case DEPT_ONLY:
                if (deptCol != null && loginUser.getDeptId() != null) {
                    return new EqualsTo(new Column(tableName + "." + deptCol),
                            new LongValue(loginUser.getDeptId()));
                }
                return null;

            case DEPT_AND_CHILD:
                if (deptCol != null && loginUser.getDeptId() != null) {
                    Set<Long> descendantIds = deptMapper.getObject().selectDescendantIds(loginUser.getDeptId());
                    if (descendantIds.isEmpty()) {
                        return new EqualsTo(new Column(tableName + "." + deptCol),
                                new LongValue(loginUser.getDeptId()));
                    }
                    ExpressionList<Expression> exprList = new ExpressionList<>();
                    descendantIds.forEach(id -> exprList.addExpressions(new LongValue(id)));
                    return new InExpression(new Column(tableName + "." + deptCol), exprList);
                }
                return null;

            case CUSTOM:
                Set<Long> deptIds = result.getDeptIds();
                if (deptCol != null && !deptIds.isEmpty()) {
                    ExpressionList<Expression> exprList = new ExpressionList<>();
                    deptIds.forEach(id -> exprList.addExpressions(new LongValue(id)));
                    return new InExpression(new Column(tableName + "." + deptCol), exprList);
                }
                return null;

            case ALL:
            default:
                return null;
        }
    }

    private boolean hasCustomDataScope(List<Role> roles) {
        return roles != null && roles.stream()
                .anyMatch(role -> role.getDataScope() != null && role.getDataScope() == 2);
    }

    private LoginUser getLoginUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return null;
        Object principal = auth.getPrincipal();
        if (principal instanceof LoginUser loginUser) return loginUser;
        return null;
    }
}
